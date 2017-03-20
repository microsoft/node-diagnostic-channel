// This file will essentially be its own package

export type ISubscriber = (event: any) => void;

class ContextPreservingEventEmitter {
    private subscribers: {[key: string]: ISubscriber[]} = {};

    public publish(name: string, event: any): void {
        const listeners = this.subscribers[name];
        // Note: Listeners called synchronously to preserve context
        if (listeners) {
            listeners.forEach((l) => {
                try {
                    l(event)
                } catch (e) {
                    // Subscriber threw an error
                }
            });
        }
    }

    public subscribe(name: string, listener: ISubscriber): void {
        if (!this.subscribers[name]) {
            this.subscribers[name] = [];
        }

        this.subscribers[name].push(listener);
    }

    public unsubscribe(name: string, listener: ISubscriber): void {
        const listeners = this.subscribers[name];
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }

    // Used for tests
    public reset(): void {
        this.subscribers = {};
    }
}

// TODO: Should this be a global object to avoid issues with multiple different versions of the package that defines it?
export const channel = new ContextPreservingEventEmitter();