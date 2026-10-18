'use strict';

/**
 * ???? - ???????
 * ??/?????????????????
 */
class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.events = new Map();
    }

    /**
     * ????
     * @param {string} event - ???
     * @param {Function} callback - ????
     * @returns {Function} ??????
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return () => this.off(event, callback);
    }

    /**
     * ????
     * @param {string} event - ???
     * @param {Function} callback - ????
     */
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }

    /**
     * ????
     * @param {string} event - ???
     * @param {any} data - ????
     */
    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
    }

    /**
     * ?????
     * @param {string} event - ???
     * @param {Function} callback - ????
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    /** ?????? */
    clear() {
        this.events.clear();
    }
}

window.EventBus = EventBus;
window.eventBus = new EventBus();