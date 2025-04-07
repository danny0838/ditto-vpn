/**
 * The content script with event listeners.
 */
((function (global, factory) {
  global = typeof globalThis !== "undefined" ? globalThis : global || self;
  factory(global.page);
})(this, function (page) {
  'use strict';

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const {cmd, args} = message;

    // eslint-disable-next-line no-unused-vars
    const senderInfo = '[' +
      (sender.tab ? sender.tab.id : -1) +
      (typeof sender.frameId !== 'undefined' ? ':' + sender.frameId : '') +
      ']';

    // console.debug('Received message from %s with command "%s" and arguments %o', senderInfo, cmd, args);

    const parts = cmd.split('.');
    const subCmd = parts.pop();
    const object = parts.reduce((obj, part) => obj[part], page);

    (async () => {
      try {
        if (!object || !subCmd || typeof object[subCmd] !== 'function') {
          throw new Error(`無法執行命令: "${cmd}"`);
        }
        const response = await object[subCmd](...(args ?? []), sender);
        sendResponse({response});
      } catch (ex) {
        console.error(ex);
        sendResponse({error: {message: ex.message}});
      }
    })();

    return true;
  });
}));
