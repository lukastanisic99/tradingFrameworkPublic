import { Observable } from './util/Observer/Observer';
import SafeMath from './util/SafeMath';

class Balance extends Observable {
    private asset: string;
    private available: number;
    private locked: number;

    public constructor(asset: string) {
        super();
        this.asset = asset;
        this.available = 0;
        this.locked = 0;
    }

    public getAsset(): string {
        return this.asset;
    }

    public getAvailable(): number {
        return this.available;
    }

    public getLocked(): number {
        return this.locked;
    }

    public setAvailable(amount: number) {
        this.available = amount;
        this.notifyAll();
    }

    public setLocked(amount: number) {
        this.locked = amount;
        this.notifyAll();
    }

    public reserve(amount: number): number {
        if (amount >= 0 && amount <= this.available) {
            this.available = SafeMath.sub(this.available, amount);
            this.locked = SafeMath.add(this.locked, amount);
            this.notifyAll();
            return amount;
        }
        // throw new Error("Can't reserve: " + amount + ' with balance ' + this.asset + ' - Available:' + this.available + ' Locked:' + this.locked);
        return 0;
    }

    public release(amount: number): number {
        if (amount >= 0 && amount <= this.locked) {
            this.locked = SafeMath.sub(this.locked, amount);
            this.available = SafeMath.add(this.available, amount);
            this.notifyAll();
            return amount;
        }
        return 0;
        // throw new Error("Can't release: " + amount + ' with balance ' + this.asset + ' - Available:' + this.available + ' Locked:' + this.locked);
    }

    public increaseAvailable(amount: number) {
        if (amount >= 0) {
            this.available = SafeMath.add(this.available, amount);
            this.notifyAll();
            return;
        }
        throw new Error("Can't increaseAvailable: " + amount + ' with balance ' + this.asset + ' - Available:' + this.available + ' Locked:' + this.locked);
    }

    public decreaseAvailable(amount: number) {
        if (amount >= 0 && amount <= this.available) {
            this.available = SafeMath.sub(this.available, amount);
            this.notifyAll();
            return;
        }
        throw new Error("Can't decreaseAvailable: " + amount + ' with balance ' + this.asset + ' - Available:' + this.available + ' Locked:' + this.locked);
    }

    public decreaseLocked(amount: number) {
        if (amount >= 0 && amount <= this.locked) {
            this.locked = SafeMath.sub(this.locked, amount);
            this.notifyAll();
            return;
        }
        throw new Error("Can't decreaseLocked: " + amount + ' with balance ' + this.asset + ' - Available:' + this.available + ' Locked:' + this.locked);
    }
}

export default Balance;
