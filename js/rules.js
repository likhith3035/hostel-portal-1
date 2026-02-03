import { checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar } from '../main.js';
import { doc, getDoc } from './firebase/firebase-firestore.js';

window.markNotificationsAsRead = markNotificationsAsRead || function () { };
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);




    // --- RULES LOGIC ---
    const rules = [
        { title: 'Silent Hours', description: 'Strict silence must be observed from 10:00 PM to 6:00 AM to ensure undisturbed study and sleep.', icon: 'fa-moon', category: 'conduct', color: 'blue' },
        { title: 'Gate Curfew', description: 'Hostel gates close at 9:30 PM. Late entry is strictly prohibited without written warden permission.', icon: 'fa-door-closed', category: 'timings', color: 'indigo' },
        { title: 'Mess Schedule', description: 'Breakfast: 7:30-9 AM | Lunch: 12:30-2 PM | Dinner: 7:30-9 PM. No meals allowed in rooms.', icon: 'fa-utensils', category: 'timings', color: 'orange' },
        { title: 'Visitor Protocol', description: 'Guests allowed in designated parlors only from 4:00 PM to 7:00 PM. No overnight guests.', icon: 'fa-users', category: 'visitors', color: 'purple' },
        { title: 'Room Hygiene', description: 'Inmates are responsible for their room cleanliness. Daily inspections may be conducted.', icon: 'fa-broom', category: 'conduct', color: 'green' },
        { title: 'Restricted Items', description: 'Strict prohibition of alcohol, smoking, narcotics, and high-wattage electrical appliances.', icon: 'fa-ban', category: 'safety', color: 'red' },
        { title: 'Anti-Ragging', description: 'Ragging is a criminal offense. Anyone found involved will be summarily expelled and reported.', icon: 'fa-shield-halved', category: 'safety', color: 'red' },
        { title: 'Power Saving', description: 'Switch off lights, fans, and ACs when leaving the room. Help us save energy.', icon: 'fa-bolt', category: 'safety', color: 'yellow' },
        { title: 'Internet Usage', description: 'Misuse of college Wi-Fi for illegal activities will lead to permanent blockage of MAC address.', icon: 'fa-wifi', category: 'conduct', color: 'cyan' },
        { title: 'Property Damage', description: 'Intentional damage to hostel property will attract heavy fines plus the cost of replacement.', icon: 'fa-gavel', category: 'conduct', color: 'pink' }
    ];

    const rulesGrid = document.getElementById('rules-grid');
    const filterContainer = document.getElementById('filter-container');
    const searchInput = document.getElementById('rule-search');
    let activeFilter = 'all';
    let searchQuery = '';

    const colorMaps = {
        blue: 'text-blue-500 bg-blue-500/10',
        indigo: 'text-indigo-500 bg-indigo-500/10',
        orange: 'text-orange-500 bg-orange-500/10',
        purple: 'text-purple-500 bg-purple-500/10',
        green: 'text-green-500 bg-green-500/10',
        red: 'text-red-500 bg-red-500/10 border-red-500/20',
        yellow: 'text-yellow-500 bg-yellow-500/10',
        cyan: 'text-cyan-500 bg-cyan-500/10',
        pink: 'text-pink-500 bg-pink-500/10'
    };

    const renderRules = () => {
        if (!rulesGrid) return;
        rulesGrid.innerHTML = '';

        const filtered = rules.filter(rule => {
            const matchesFilter = activeFilter === 'all' || rule.category === activeFilter;
            const matchesSearch = rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                rule.description.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            rulesGrid.innerHTML = `
                <div class="col-span-full py-20 text-center animate-fade-in">
                    <div class="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 text-3xl">
                        <i class="fas fa-search-minus"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">No matching rules</h3>
                    <p class="text-gray-500 dark:text-gray-400">Try adjusting your search or filters.</p>
                </div>`;
            return;
        }

        filtered.forEach((rule, index) => {
            const colorClass = colorMaps[rule.color] || colorMaps.blue;
            const card = `
                <div class="glass-panel p-8 rounded-[2.2rem] relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 shadow-glass hover:shadow-2xl hover:shadow-blue-500/10 animate-fade-in border border-white/50 dark:border-white/5" style="animation-delay: ${index * 50}ms">
                    <div class="absolute -top-10 -right-10 w-32 h-32 ${colorClass.split(' ')[1]} opacity-0 group-hover:opacity-100 rounded-full blur-3xl transition-opacity duration-700"></div>
                    
                    <div class="relative z-10">
                        <div class="flex items-start justify-between mb-6">
                            <div class="w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center text-2xl shadow-lg ring-4 ring-white dark:ring-white/5 transition-transform group-hover:scale-110 duration-500">
                                <i class="fas ${rule.icon}"></i>
                            </div>
                            <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-iosBlue transition-colors">${rule.category}</span>
                        </div>
                        
                        <h3 class="font-bold text-xl text-gray-900 dark:text-white mb-3 tracking-tight">${rule.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium mb-0 opacity-80 group-hover:opacity-100 transition-opacity">${rule.description}</p>
                    </div>
                    
                    <div class="mt-8 pt-6 border-t border-gray-100 dark:border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 duration-500">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Effective Immediately</span>
                        <div class="flex gap-1">
                            <div class="w-1.5 h-1.5 rounded-full bg-iosBlue"></div>
                            <div class="w-1.5 h-1.5 rounded-full bg-iosBlue opacity-40"></div>
                        </div>
                    </div>
                </div>`;
            rulesGrid.insertAdjacentHTML('beforeend', card);
        });
    };

    filterContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderRules();
        }
    });

    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderRules();
    });

    renderRules();
});

