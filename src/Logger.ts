import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import axios from 'axios';
class Logger {
    private static instance: Logger;
    private static dir = path.resolve(__dirname, '../log'); //relative to Logger.ts
    private static path = Logger.dir + '/log.txt';
    private static notificationSecret: string;

    public static log(msg: string, notification: boolean = false, fileName?: string) {
        //load once notification secret
        if (notification && !Logger.notificationSecret) {
            if (!process.env.NOTIFICATION_SECRET) throw new Error('NOTIFICATION_SECRET is not defined');
            Logger.notificationSecret = process.env.NOTIFICATION_SECRET;
        }
        if (!fs.existsSync(Logger.dir)) {
            fs.mkdirSync(Logger.dir);
        }
        let path = fileName ? Logger.dir + '/' + fileName + '.txt' : Logger.path;
        if (notification) axios.post('https://maker.ifttt.com/trigger/notification_trigger/with/key/' + Logger.notificationSecret, { value1: msg + ' - ' + fileName });
        fs.appendFileSync(path, msg + '\n');
    }

    public static logError(msg: string) {
        Logger.log(msg, true, 'Error');
    }
}

export default Logger;
