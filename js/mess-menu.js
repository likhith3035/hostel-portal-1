import { checkUserSession, db, markNotificationsAsRead, toggleSidebar, toggleTheme, showToast, CONSTANTS } from '../main.js?v=2';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    limit,
    onSnapshot,
    where,
    setDoc,
    serverTimestamp
} from './firebase/firebase-firestore.js';

// Globals & Config
window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;

// Constants
const mealConfig = {
    breakfast: { label: 'Breakfast', time: '07:30 - 09:00 AM', icon: 'fa-mug-hot', color: 'amber', start: 7, end: 10 },
    lunch: { label: 'Lunch', time: '12:30 - 02:00 PM', icon: 'fa-sun', color: 'orange', start: 12, end: 15 },
    snacks: { label: 'Snacks', time: '04:30 - 05:30 PM', icon: 'fa-cookie-bite', color: 'pink', start: 16, end: 18 },
    dinner: { label: 'Dinner', time: '07:30 - 09:00 PM', icon: 'fa-moon', color: 'indigo', start: 19, end: 22 },
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkUserSession(false);

    let allMenus = {};
    let userRatings = {};
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayLower = new Date().toLocaleString('en-us', { weekday: 'long' }).toLowerCase();
    const currentHour = new Date().getHours();

    // Local Async Execution to avoid Global Loader Overlay
    const loadMenuData = async () => {
        try {
            const menuSnapshot = await getDocs(collection(db, CONSTANTS.COLLECTIONS.MESS_MENU));

            menuSnapshot.forEach(docSnap => {
                allMenus[docSnap.id.toLowerCase()] = docSnap.data();
            });

            if (user) {
                const ratingsQ = query(collection(db, CONSTANTS.COLLECTIONS.MEAL_RATINGS), where('userId', '==', user.uid));
                const ratingsSnapshot = await getDocs(ratingsQ);
                ratingsSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    userRatings[`${data.day}-${data.meal}`] = data.rating;
                });
            }

            // Determine Hero Meal
            let heroMealKey = 'breakfast';
            if (currentHour >= 10 && currentHour < 15) heroMealKey = 'lunch';
            else if (currentHour >= 15 && currentHour < 18) heroMealKey = 'snacks';
            else if (currentHour >= 18) heroMealKey = 'dinner';
            else if (currentHour >= 22) heroMealKey = 'breakfast';

            const heroDayIndex = (currentHour >= 22) ? (new Date().getDay() + 1) % 7 : new Date().getDay();
            const heroDay = days[heroDayIndex];
            const heroData = allMenus[heroDay]?.[heroMealKey] || { item: 'Not Scheduled' };

            // Update Hero UI
            const heroNameEl = document.getElementById('hero-meal-name');
            const heroTypeEl = document.getElementById('hero-meal-type');
            const heroTimeEl = document.getElementById('hero-meal-time');

            if (heroNameEl) heroNameEl.innerText = heroData.item || 'Not Available';
            if (heroTypeEl) heroTypeEl.innerText = mealConfig[heroMealKey].label;
            if (heroTimeEl) heroTimeEl.innerText = mealConfig[heroMealKey].time;

            const renderMenuGrid = (selectedDay) => {
                const grid = document.getElementById('menu-grid');
                if (!grid) return;
                grid.innerHTML = '';
                const dayData = allMenus[selectedDay] || {};

                Object.entries(mealConfig).forEach(([key, config], index) => {
                    const mealData = dayData[key] || { item: 'Not Scheduled', isSpecial: false };
                    const ratingKey = `${selectedDay}-${key}`;
                    const myRating = userRatings[ratingKey];

                    // Glass Card Design
                    grid.insertAdjacentHTML('beforeend', `
                        <div class="glass-panel bg-white/40 dark:bg-black/20 rounded-[2rem] p-6 border border-white/20 shadow-sm hover:shadow-glow hover:scale-[1.02] transition-all duration-300 flex flex-col h-full animate-fade-in-up backdrop-blur-md" style="animation-delay: ${index * 50}ms">
                            
                            <!-- Header -->
                            <div class="flex justify-between items-start mb-4">
                                <div class="w-10 h-10 rounded-2xl bg-white/50 dark:bg-white/5 text-${config.color}-600 dark:text-${config.color}-400 flex items-center justify-center border border-white/20 shadow-sm backdrop-blur-sm">
                                    <i class="fas ${config.icon} text-lg"></i>
                                </div>
                                ${mealData.isSpecial ? `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-200/50 dark:border-amber-500/20 backdrop-blur-sm">
                                        <i class="fas fa-star text-[8px]"></i> Special
                                    </span>
                                ` : ''}
                            </div>

                            <!-- Content -->
                            <div class="flex-1 mb-6">
                                <h3 class="text-[10px] font-bold text-gray-500/80 dark:text-gray-400 uppercase tracking-widest mb-1">${config.label}</h3>
                                <p class="text-lg font-bold text-gray-900 dark:text-white leading-tight line-clamp-3">${escapeHTML(mealData.item)}</p>
                            </div>
                            
                            <!-- Footer -->
                            <div class="mt-auto pt-4 border-t border-gray-200/50 dark:border-white/5 flex flex-col gap-3">
                                <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    <i class="far fa-clock"></i> ${config.time}
                                </div>

                                <!-- Actions -->
                                ${user ? `
                                <div class="grid grid-cols-2 gap-2">
                                    <button onclick="rateMeal('${selectedDay}', '${key}', 'like', this)" 
                                         class="py-2.5 rounded-xl border border-white/20 flex items-center justify-center gap-1.5 ${myRating === 'like' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 border-green-500' : 'bg-white/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10'} transition-all active:scale-95 backdrop-blur-sm group">
                                        <i class="${myRating === 'like' ? 'fas' : 'far'} fa-heart text-xs group-hover:scale-110 transition-transform"></i>
                                        <span class="text-[10px] font-bold uppercase">Like</span>
                                    </button>
                                    <button onclick="rateMeal('${selectedDay}', '${key}', 'dislike', this)" 
                                         class="py-2.5 rounded-xl border border-white/20 flex items-center justify-center gap-1.5 ${myRating === 'dislike' ? 'bg-zinc-800 text-white shadow-lg border-zinc-800' : 'bg-white/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10'} transition-all active:scale-95 backdrop-blur-sm group">
                                        <i class="${myRating === 'dislike' ? 'fas' : 'far'} fa-thumbs-down text-xs group-hover:scale-110 transition-transform"></i>
                                        <span class="text-[10px] font-bold uppercase">Pass</span>
                                    </button>
                                </div>` :
                            `<div class="p-2 rounded-xl bg-white/30 dark:bg-white/5 border border-white/10 text-[10px] text-center font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider backdrop-blur-sm">Login to Rate</div>`
                        }
                            </div>
                        </div>`);
                });
            };

            const daySelector = document.getElementById('day-selector');
            if (daySelector) {
                daySelector.innerHTML = '';
                const todayIndex = days.indexOf(todayLower);
                // Reorder days starting from today
                const orderedDays = [...days.slice(todayIndex), ...days.slice(0, todayIndex)];

                orderedDays.forEach((day, index) => {
                    const date = new Date();
                    date.setDate(date.getDate() + index);

                    const btn = document.createElement('button');
                    const isActive = day === todayLower;

                    const baseClasses = "flex-shrink-0 relative group w-14 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 snap-center outline-none select-none border";
                    const activeClasses = "bg-iosBlue text-white shadow-lg shadow-blue-500/30 scale-105 border-blue-400 z-10";
                    const inactiveClasses = "glass-panel bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 border-white/10 hover:border-white/20 hover:scale-[1.02]";

                    btn.className = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;

                    btn.innerHTML = `
                        <span class="text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isActive ? 'opacity-90' : 'opacity-60'} group-hover:opacity-100 transition-opacity">${day.substring(0, 3)}</span>
                        <span class="text-xl font-bold font-sans tracking-tight">${date.getDate()}</span>
                        ${isActive ? '<div class="absolute bottom-2 w-1 h-1 bg-white rounded-full opacity-50"></div>' : ''}
                    `;

                    btn.onclick = () => {
                        // Reset all
                        const buttons = daySelector.querySelectorAll('button');
                        buttons.forEach(b => {
                            b.className = `${baseClasses} ${inactiveClasses}`;
                            // Remove dot
                            const dot = b.querySelector('.absolute.bottom-2');
                            if (dot) dot.remove();
                            // Reset opacity
                            b.querySelector('span:first-child').className = "text-[9px] font-bold uppercase tracking-widest mb-0.5 opacity-60 group-hover:opacity-100 transition-opacity";
                        });

                        // Set active
                        btn.className = `${baseClasses} ${activeClasses}`;
                        btn.insertAdjacentHTML('beforeend', '<div class="absolute bottom-2 w-1 h-1 bg-white rounded-full opacity-50"></div>');
                        btn.querySelector('span:first-child').className = "text-[9px] font-bold uppercase tracking-widest mb-0.5 opacity-90 group-hover:opacity-100 transition-opacity";

                        // Scroll into view nicely
                        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

                        // Render
                        renderMenuGrid(day);
                    };
                    daySelector.appendChild(btn);
                });
            }
            renderMenuGrid(todayLower);

        } catch (error) {
            console.error(error);
            window.errorHandler(error);
            const grid = document.getElementById('menu-grid');
            if (grid) grid.innerHTML = `<div class="col-span-full p-8 text-center text-gray-500">Failed to load menu. Please try refreshing.</div>`;
        }
    };

    loadMenuData();

    window.rateMeal = (day, meal, rating, btn) => {
        window.safeAsync(async () => {
            if (!user) throw new Error('Security Error: Unauthorized rating attempt.');
            const ratingId = `${user.uid}_${day}_${meal}`;
            await setDoc(doc(db, CONSTANTS.COLLECTIONS.MEAL_RATINGS, ratingId), {
                userId: user.uid,
                userEmail: user.email || 'anonymous',
                day, meal, rating,
                timestamp: serverTimestamp()
            });
            showToast('Feedback submitted');

            const container = btn.parentElement;
            const likeBtn = container.children[0];
            const dislikeBtn = container.children[1];

            // Tailwind Class Sets
            const baseClasses = 'py-2.5 rounded-xl border border-white/20 flex items-center justify-center gap-1.5 bg-white/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm group';

            const likeActiveClasses = 'py-2.5 rounded-xl border border-green-500 flex items-center justify-center gap-1.5 bg-green-500 text-white shadow-lg shadow-green-500/30 transition-all active:scale-95 backdrop-blur-sm group';

            const dislikeActiveClasses = 'py-2.5 rounded-xl border border-zinc-800 flex items-center justify-center gap-1.5 bg-zinc-800 text-white shadow-lg border-zinc-800 transition-all active:scale-95 backdrop-blur-sm group';

            // Reset
            likeBtn.className = baseClasses;
            likeBtn.querySelector('i').className = 'far fa-heart text-xs group-hover:scale-110 transition-transform';

            dislikeBtn.className = baseClasses;
            dislikeBtn.querySelector('i').className = 'far fa-thumbs-down text-xs group-hover:scale-110 transition-transform';

            // Apply Active
            if (rating === 'like') {
                likeBtn.className = likeActiveClasses;
                likeBtn.querySelector('i').className = 'fas fa-heart text-xs group-hover:scale-110 transition-transform';
            } else {
                dislikeBtn.className = dislikeActiveClasses;
                dislikeBtn.querySelector('i').className = 'fas fa-thumbs-down text-xs group-hover:scale-110 transition-transform';
            }
        }, 'Saving feedback...');
    };
});
