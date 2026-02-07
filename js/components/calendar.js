/**
 * Premium Animated Calendar Component
 * Built with Alpine.js for the NBKRIST Hostel Portal
 */

document.addEventListener('alpine:init', () => {
    Alpine.data('animatedCalendar', (initialValue = null, type = 'single', defaultOffsetMinutes = 30) => {
        // Calculate a safe default time (offset from now, rounded to nearest 30)
        const now = new Date();
        const futureDate = new Date(now.getTime() + defaultOffsetMinutes * 60000);
        const h = futureDate.getHours().toString().padStart(2, '0');
        const m = futureDate.getMinutes() < 30 ? '00' : '30';
        const defaultTime = `${h}:${m}`;
        const defaultDateStr = `${futureDate.getFullYear()}-${(futureDate.getMonth() + 1).toString().padStart(2, '0')}-${futureDate.getDate().toString().padStart(2, '0')} ${defaultTime}`;

        const startValue = initialValue || defaultDateStr;
        const [datePart, timePart] = startValue.split(' ');

        return {
            value: startValue,
            isOpen: false,
            viewDate: new Date(datePart.replace(/-/g, '/')),
            selectedDate: new Date(datePart.replace(/-/g, '/')),
            selectedTime: timePart || defaultTime,
            days: [],
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            timeSlots: [],

            init() {
                this.generateCalendar();
                this.generateTimeSlots();
                this.updateValue();

                this.$watch('value', val => {
                    if (this.$refs.input) this.$refs.input.value = val;
                    // Support manual value updates from outside
                    if (val && val !== this.formatInternal()) {
                        this.parseValue(val);
                    }
                });
            },

            parseValue(val) {
                try {
                    const [d, t] = val.split(' ');
                    this.selectedDate = new Date(d.replace(/-/g, '/'));
                    this.selectedTime = t;
                    this.viewDate = new Date(this.selectedDate);
                    this.generateCalendar();
                } catch (e) {
                    console.error("Calendar parse error:", e);
                }
            },

            formatInternal() {
                if (!this.selectedDate) return '';
                const year = this.selectedDate.getFullYear();
                const month = (this.selectedDate.getMonth() + 1).toString().padStart(2, '0');
                const day = this.selectedDate.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${this.selectedTime}`;
            },

            generateTimeSlots() {
                const slots = [];
                for (let h = 0; h < 24; h++) {
                    const hour = h.toString().padStart(2, '0');
                    slots.push(`${hour}:00`);
                    slots.push(`${hour}:30`);
                }
                this.timeSlots = slots;
            },

            generateCalendar() {
                const year = this.viewDate.getFullYear();
                const month = this.viewDate.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const prevDaysInMonth = new Date(year, month, 0).getDate();

                const days = [];
                const today = new Date();

                for (let i = firstDay - 1; i >= 0; i--) {
                    days.push({
                        day: prevDaysInMonth - i,
                        month: month - 1,
                        year: year,
                        isCurrentMonth: false
                    });
                }

                for (let i = 1; i <= daysInMonth; i++) {
                    days.push({
                        day: i,
                        month: month,
                        year: year,
                        isCurrentMonth: true,
                        isToday: i === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                    });
                }

                const totalSlots = 42;
                const remaining = totalSlots - days.length;
                for (let i = 1; i <= remaining; i++) {
                    days.push({
                        day: i,
                        month: month + 1,
                        year: year,
                        isCurrentMonth: false
                    });
                }
                this.days = days;
            },

            prevMonth() {
                this.viewDate.setMonth(this.viewDate.getMonth() - 1);
                this.generateCalendar();
            },

            nextMonth() {
                this.viewDate.setMonth(this.viewDate.getMonth() + 1);
                this.generateCalendar();
            },

            selectDate(day) {
                const newDate = new Date(day.year, day.month, day.day);
                this.selectedDate = newDate;
                this.viewDate = new Date(newDate);
                this.updateValue(true);
            },

            selectTime(time) {
                this.selectedTime = time;
                this.updateValue(true);
            },

            updateValue(isUserAction = false) {
                if (!this.selectedDate) return;
                const newValue = this.formatInternal();
                if (this.value !== newValue) {
                    this.value = newValue;
                    if (isUserAction) {
                        this.$dispatch('date-change', { value: this.value });
                    }
                }
            },

            isSelected(day) {
                if (!this.selectedDate) return false;
                return day.day === this.selectedDate.getDate() &&
                    day.month === this.selectedDate.getMonth() &&
                    day.year === this.selectedDate.getFullYear();
            },

            toggle() {
                this.isOpen = !this.isOpen;
                if (this.isOpen) {
                    this.viewDate = new Date(this.selectedDate);
                    this.generateCalendar();
                }
            }
        };
    });
});
