// This file will essentially be its own package

export type ISubscriber = (event: any) => void;

class ContextPreservingEventEmitter {
    private subscribers: {[key: string]: ISubscriber[]} = {};
    private contextPreservationFunction: (cb: Function) => Function = (cb) => cb; 

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
        this.contextPreservationFunction = (cb) => cb;
    }

    public bindToContext(cb: Function) {
        return this.contextPreservationFunction(cb);
    }

    public addContextPreservation(preserver: (cb: Function) => Function) {
        const previousPreservationStack = this.contextPreservationFunction;
        this.contextPreservationFunction = (cb) => preserver(previousPreservationStack(cb));
    }
}

// TODO: Should this be a global object to avoid issues with multiple different versions of the package that defines it?
export const channel = new ContextPreservingEventEmitter();