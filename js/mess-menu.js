import { checkUserSession, db, markNotificationsAsRead, toggleSidebar, toggleTheme, showToast, CONSTANTS } from '../main.js';
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

    window.safeAsync(async () => {
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

            Object.entries(mealConfig).forEach(([key, config]) => {
                const mealData = dayData[key] || { item: 'Not Scheduled', isSpecial: false };
                const ratingKey = `${selectedDay}-${key}`;
                const myRating = userRatings[ratingKey];

                // Premium Meal Card Design (Compact)
                grid.insertAdjacentHTML('beforeend', `
                    <div class="glass-panel p-5 rounded-[2rem] relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border border-white/40 dark:border-white/10 shadow-sm hover:shadow-glow group flex flex-col justify-between min-h-[180px]">
                        
                        <!-- Dynamic Background -->
                        <div class="absolute -right-8 -top-8 w-32 h-32 bg-${config.color}-500/10 rounded-full blur-[50px] group-hover:bg-${config.color}-500/20 transition-all duration-700"></div>

                        <div class="relative z-10 w-full">
                            
                            <div class="flex items-start justify-between mb-4">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-${config.color}-50 to-${config.color}-100 dark:from-${config.color}-900/30 dark:to-${config.color}-800/10 flex items-center justify-center text-${config.color}-500 text-2xl shadow-inner border border-white/50 dark:border-white/10 group-hover:rotate-6 transition-transform duration-300">
                                    <i class="fas ${config.icon} drop-shadow-sm"></i>
                                </div>
                                ${mealData.isSpecial ? `
                                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-200 to-orange-400 text-black text-[8px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 animate-pulse">
                                        <i class="fas fa-star text-[7px]"></i> Special
                                    </span>
                                ` : ''}
                            </div>

                            <div class="mb-4">
                                <h3 class="font-extrabold text-${config.color}-600 dark:text-${config.color}-400 uppercase tracking-widest text-[9px] mb-1 pl-0.5">${config.label}</h3>
                                <p class="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2 break-words tracking-tight line-clamp-2">${escapeHTML(mealData.item)}</p>
                                
                                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                    <i class="far fa-clock text-[10px] text-gray-400"></i>
                                    <p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 tabular-nums tracking-wide">${config.time}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Action Bar -->
                        ${user ? `
                        <div class="mt-auto pt-4 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-2 relative z-10">
                            <button onclick="rateMeal('${selectedDay}', '${key}', 'like', this)" 
                                 class="like-anim py-2 rounded-xl bg-white dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-900/10 border border-gray-100 dark:border-white/10 hover:border-red-200 dark:hover:border-red-500/20 transition-all flex items-center justify-center gap-1.5 group/btn active:scale-95 ${myRating === 'like' ? 'like-active bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20' : ''}">
                                <i class="${myRating === 'like' ? 'fas' : 'far'} fa-heart text-sm group-hover/btn:text-red-500 transition-colors ${myRating === 'like' ? 'text-red-500' : 'text-gray-400'}"></i>
                                <span class="text-[10px] font-bold ${myRating === 'like' ? 'text-red-500' : 'text-gray-500'}">Like</span>
                            </button>
                            <button onclick="rateMeal('${selectedDay}', '${key}', 'dislike', this)" 
                                 class="like-anim py-2 rounded-xl bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 transition-all flex items-center justify-center gap-1.5 group/btn active:scale-95 ${myRating === 'dislike' ? 'bg-gray-100 dark:bg-white/10' : ''}">
                                <i class="${myRating === 'dislike' ? 'fas' : 'far'} fa-thumbs-down text-sm group-hover/btn:text-gray-600 dark:group-hover/btn:text-white transition-colors ${myRating === 'dislike' ? 'text-gray-600 dark:text-white' : 'text-gray-400'}"></i>
                                <span class="text-[10px] font-bold ${myRating === 'dislike' ? 'text-gray-600 dark:text-white' : 'text-gray-500'}">Pass</span>
                            </button>
                        </div>` :
                        `<div class="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
                            <p class="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest opacity-50">Login to Rate</p>
                        </div>`
                    }
                    </div>`);
            });
        };

        const daySelector = document.getElementById('day-selector');
        if (daySelector) {
            daySelector.innerHTML = '';
            const todayIndex = days.indexOf(todayLower);
            const orderedDays = [...days.slice(todayIndex), ...days.slice(0, todayIndex)];

            orderedDays.forEach((day, index) => {
                const date = new Date();
                date.setDate(date.getDate() + index);
                const btn = document.createElement('button');
                const isActive = day === todayLower;
                btn.className = `day-tab flex-shrink-0 flex flex-col items-center justify-center w-[60px] h-[60px] rounded-2xl border transition-all duration-200 ${isActive ? 'bg-iosBlue text-white shadow-lg border-transparent' : 'bg-white dark:bg-white/5 border-transparent text-gray-500'}`;
                btn.innerHTML = `<span class="text-[10px] font-bold uppercase tracking-widest opacity-80">${day.substring(0, 3)}</span><span class="text-xl font-bold">${date.getDate()}</span>`;
                btn.onclick = () => {
                    daySelector.querySelectorAll('.day-tab').forEach(b => b.classList.remove('bg-iosBlue', 'text-white'));
                    btn.classList.add('bg-iosBlue', 'text-white');
                    renderMenuGrid(day);
                };
                daySelector.appendChild(btn);
            });
        }
        renderMenuGrid(todayLower);
    }, 'Loading Menu...');

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

            // Reset both
            likeBtn.classList.remove('like-active', 'bg-red-50/50', 'border-red-100', 'text-red-500');
            likeBtn.querySelector('i').className = 'far fa-heart text-lg group-hover/btn:text-red-500 transition-colors';
            likeBtn.querySelector('span').classList.remove('text-red-500');

            dislikeBtn.classList.remove('text-gray-600', 'bg-gray-200', 'dark:bg-white/20');
            dislikeBtn.querySelector('i').className = 'far fa-thumbs-down text-lg group-hover/btn:text-gray-600 transition-colors';

            // Apply active state
            if (rating === 'like') {
                likeBtn.classList.add('like-active', 'bg-red-50/50', 'border-red-100', 'text-red-500');
                likeBtn.querySelector('i').className = 'fas fa-heart text-lg text-red-500';
                likeBtn.querySelector('span').classList.add('text-red-500');
            } else {
                dislikeBtn.classList.add('text-gray-600', 'bg-gray-200', 'dark:bg-white/20');
                dislikeBtn.querySelector('i').className = 'fas fa-thumbs-down text-lg';
            }
        }, 'Saving feedback...');
    };
});
