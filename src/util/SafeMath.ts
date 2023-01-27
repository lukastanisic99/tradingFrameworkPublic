class SafeMath {
    public static add(a: number, b: number): number {
        let aSplit = a.toString().split('.');
        let bSlit = b.toString().split('.');
        let decLenghtA = aSplit[1] != undefined ? aSplit[1].length : 0;
        let decLenghtB = bSlit[1] != undefined ? bSlit[1].length : 0;
        let maxDec = decLenghtA > decLenghtB ? decLenghtA : decLenghtB;
        let pow = 10 ** maxDec;
        return (a * pow + b * pow) / pow;
    }
    public static sub(a: number, b: number): number {
        let aSplit = a.toString().split('.');
        let bSlit = b.toString().split('.');
        let decLenghtA = aSplit[1] != undefined ? aSplit[1].length : 0;
        let decLenghtB = bSlit[1] != undefined ? bSlit[1].length : 0;
        let maxDec = decLenghtA > decLenghtB ? decLenghtA : decLenghtB;
        let pow = 10 ** maxDec;
        return (a * pow - b * pow) / pow;
    }

    public static mul(a: number, b: number): number {
        let aSplit = a.toString().split('.');
        let bSlit = b.toString().split('.');
        let decLenghtA = aSplit[1] != undefined ? aSplit[1].length : 0;
        let decLenghtB = bSlit[1] != undefined ? bSlit[1].length : 0;

        let pow1 = 10 ** decLenghtA;
        let pow2 = 10 ** decLenghtB;

        return (a * pow1 * (b * pow2)) / pow1 / pow2;
    }

    public static div(a: number, b: number): number {
        let aSplit = a.toString().split('.');
        let bSlit = b.toString().split('.');
        let decLenghtA = aSplit[1] != undefined ? aSplit[1].length : 0;
        let decLenghtB = bSlit[1] != undefined ? bSlit[1].length : 0;
        let maxDec = decLenghtA > decLenghtB ? decLenghtA : decLenghtB;
        let pow = 10 ** maxDec;
        return (a * pow) / (b * pow);
    }
}

export default SafeMath;
