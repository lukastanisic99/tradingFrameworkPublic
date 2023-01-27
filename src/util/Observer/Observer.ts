export abstract class Observer {
    protected observables: Observable[] = [];
    private notified: boolean = false;
    //Called by Observable to notify observer
    protected abstract _notify(observable: Observable);

    public subscribe(observable: Observable) {
        if (observable.subscribe(this)) this.observables.push(observable);
    }
    public unsubscribe(observable: Observable) {
        if (observable.unsubscribe(this)) {
            let index = this.observables.indexOf(observable);
            if (index > -1) this.observables.splice(index, 1);
        }
    }

    public notify(observable: Observable) {
        // If many obserfables notify -> single notify
        if (!this.notified) {
            setTimeout(() => {
                this.notified = false;
                this._notify(observable);
            }, 0);
        }
        this.notified = true;
    }
}

//AKA Subject
export abstract class Observable {
    protected observers: Observer[] = [];
    private signal: boolean = false;
    public subscribe(observer: Observer): boolean {
        try {
            this.observers.push(observer);
            return true;
        } catch (e) {
            return false;
        }
    }

    public unsubscribe(observer: Observer): boolean {
        try {
            let index = this.observers.indexOf(observer);

            if (index > -1) {
                this.observers.splice(index, 1);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    public notifyAll() {
        // If 1 observable multiple notifyAll() -> single notifyAll()
        if (!this.signal) {
            setTimeout(() => {
                this.signal = false;
                for (let o of this.observers) o.notify(this); //Queueing this doesn't make sense since the queue would look like [notif1,notif2,...notifN] which will execute in that order which is the same as sync
            }, 0);
        }
        this.signal = true;
    }
}
