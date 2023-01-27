import Balance from './Balance';

class Account {
    private balances: Map<string, Balance> = new Map<string, Balance>();

    public getBalance(asset: string) {
        let balance = this.balances.get(asset);
        if (!balance) {
            balance = new Balance(asset);
            this.balances.set(asset, balance);
        }
        return balance;
    }
}

export default Account;
