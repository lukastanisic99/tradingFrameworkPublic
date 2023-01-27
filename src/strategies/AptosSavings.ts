import Logger from '../Logger';
import Binance from '../exchanges/binance/Binance';

class AptosSavings {
    public execute() {
        let binance = Binance.getInstance();
        //APT001
        let aptBalance = binance.getAccount().getBalance('APT');
        let intervalHandle = setInterval(() => {
            binance.signRequest('GET', '/sapi/v1/lending/daily/userLeftQuota', { productId: 'APT001' }).then(async (data) => {
                // console.log(data);
                let available = parseFloat(data.data.leftQuota);
                let amount = aptBalance.getAvailable();
                if (amount == 0) return clearInterval(intervalHandle);
                if (available) {
                    // Logger.log(`Aptos savings available quota: ${available}`, true);
                    console.log(`Aptos savings available quota: ${available}`, true);
                    let purchaseAmount = amount <= available ? amount : available;
                    aptBalance.decreaseAvailable(purchaseAmount);
                    try {
                        let res = await binance.signRequest('POST', '/sapi/v1/lending/daily/purchase', { productId: 'APT001', amount: purchaseAmount });
                        Logger.log(`Aptos savings - purchased ${purchaseAmount}`, true);
                        console.log(`Aptos savings - purchased ${purchaseAmount}`);
                    } catch (e) {
                        console.log(e);
                        Logger.log(`Aptos savings - Error ${e.toString()}`);
                        aptBalance.increaseAvailable(purchaseAmount);
                    }
                } //else console.log('No available amount for Aptos saving :(');
            });
        }, 3500);
    }
}

export default AptosSavings;
