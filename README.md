# card-scanner

Card scanner package that enables reading of MiFare cards using [Silicon Labs driver](https://www.silabs.com/products/development-tools/software/usb-to-uart-bridge-vcp-drivers).

This package is based off [node-serialport](https://github.com/node-serialport/node-serialport).

An example of using this code is shown in [Abakus vote](https://github.com/webkom/vote/tree/master/electron-app)

## Usage

### Listing devices

```
const { refresh } from 'card-scanner';

refresh().then(ports => {
  // Handle port logic
});
```

### Connecting to devices

```
const { connect } from 'card-scanner';

const devicePath = '/dev/tty.XXX'; // Retrieved from port.comName
const callback = (response) => {
  console.log('data read', response);
}

connect(devicePath, callback).then(() => {
  // Connect successful
}).catch(err => {
  // Connect rejected
});
```

The `connect()` promise also supports a third argument, `disableThrottle`, that removes the throttle behavior that disables re-reading the same card multiple times a second with a 500ms read delay.
