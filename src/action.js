((function (global, factory) {
  global = typeof globalThis !== "undefined" ? globalThis : global || self;
  global.action = factory(global);
})(this, function (global) {
  'use strict';

  const CONTENT_SCRIPT_FILES = [
    "page.js",
    "content.js",
  ];

  function showMessage(text, type = 'info') {
    const msgElem = document.createElement('div');
    msgElem.classList.add('message');
    msgElem.classList.add(type);
    msgElem.textContent = text;

    const container = document.getElementById('message-container');
    container.insertBefore(msgElem, container.firstChild);

    setTimeout(() => {
      msgElem.classList.add('fade-out');
      setTimeout(() => msgElem.remove(), 300);
    }, 3000);
  }

  async function initContentScripts(tabId, frameId = 0) {
    // Send a test message to check whether content script is loaded.
    try {
      const result = await chrome.tabs.sendMessage(tabId, {cmd: "ping"}, {frameId});
      if (result.error) {
        throw new Error(`內容腳本執行錯誤: ${result.error.message}`);
      }
      if (result.response !== true) {
        throw new Error(`內容腳本無法正常執行`);
      }
    } catch (ex) {
      // Inject content script.
      try {
        await chrome.scripting.executeScript({
          target: {tabId, frameIds: [frameId]},
          injectImmediately: true,
          files: CONTENT_SCRIPT_FILES,
        });
      } catch (ex) {
        throw new Error(`無法載入內容腳本: ${ex.message}`);
      }

      return true;
    }

    return false;
  }

  async function invokeContentScript(tab, {cmd, args, frameId}) {
    await setSessionAccess();
    await initContentScripts(tab.id, frameId);

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, {cmd, args}, {frameId});
    } catch (ex) {
      throw new Error(`無法與內容腳本通訊: ${ex.message}`);
    }
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.response;
  }

  async function setSessionAccess() {
    const p = chrome.storage.session.setAccessLevel({accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"});
    // eslint-disable-next-line no-func-assign
    const fn = setSessionAccess = () => p;
    return await fn();
  }

  async function copyDataFromTab(tab) {
    const {id, date, fields} = await invokeContentScript(tab, {
      frameId: 0,
      cmd: 'copyFromPage',
    });
    showMessage(`已暫存個案 ${id} 於 ${date} 的數據: ${fields.join('、')}`);
  }

  async function pasteDataToTab(tab, {forceDate} = {}) {
    const {id, pasted} = await invokeContentScript(tab, {
      frameId: 0,
      cmd: 'pasteToPage',
      args: [{forceDate}],
    });

    switch (pasted.length) {
      case 0: {
        throw new Error(`沒有可帶入的數據`);
      }
      case 1: {
        const [{date, fields}] = pasted;
        showMessage(`已帶入個案 ${id} 於 ${date} 的數據: ${fields.join('、')}`);
        return;
      }
      default: {
        const forceDate = await new Promise((resolve, reject) => {
          const dialogElem = document.createElement('dialog');
          dialogElem.addEventListener('close', () => {
            resolve(dialogElem.returnValue);
            dialogElem.remove();
          });

          const header = dialogElem.appendChild(document.createElement('h3'));
          header.textContent = `個案 ${id} 有多筆數據，請選擇要帶入的項目:`;

          const form = dialogElem.appendChild(document.createElement('form'));
          form.method = 'dialog';
          form.addEventListener('submit', (e) => {
            dialogElem.returnValue = e.target.paste.value;
            dialogElem.close();
          });

          const table = form.appendChild(document.createElement('table'));
          const tbody = table.appendChild(document.createElement('tbody'));
          for (const {date, fields} of pasted) {
            const tr = tbody.appendChild(document.createElement('tr'));
            const td1 = tr.appendChild(document.createElement('td'));
            const input = td1.appendChild(document.createElement('input'));
            input.type = 'radio';
            input.name = 'paste';
            input.value = date;
            const td2 = tr.appendChild(document.createElement('td'));
            td2.textContent = `${date}: ${fields.join('、')}`;
          }
          form.elements.paste[0].checked = true;
          form.elements.paste[0].autofocus = true;

          const footer = form.appendChild(document.createElement('footer'));

          const submit = footer.appendChild(document.createElement('input'));
          submit.type = 'submit';
          submit.value = '確定';

          const cancel = footer.appendChild(document.createElement('input'));
          cancel.type = 'button';
          cancel.value = '取消';
          cancel.addEventListener('click', () => dialogElem.close());

          document.body.appendChild(dialogElem);
          dialogElem.showModal();
        });

        if (!forceDate) { return; }
        await pasteDataToTab(tab, {forceDate});
        return;
      }
    }
  }

  async function clearData() {
    await chrome.storage.session.clear();
    showMessage(`已清除暫存數據`);
  }

  function onClickHeader(event) {
    // initialize variables
    if (!onClickHeader.cleanUp) {
      onClickHeader.cleanUp = () => {
        onClickHeader.counter = 0;
        if (onClickHeader.timer) {
          clearTimeout(onClickHeader.timer);
          onClickHeader.timer = null;
        }
      };
      onClickHeader.counter = 0;
      onClickHeader.timer = null;
    }

    // set up a timer to reset the counter in 5 secs
    if (!onClickHeader.timer) {
      onClickHeader.timer = setTimeout(onClickHeader.cleanUp, 5000);
    }

    // increase the counter
    onClickHeader.counter++;

    // enable developer mode on consequtive clicks
    if (onClickHeader.counter === 6) {
      onClickHeader.cleanUp();

      const perms = {origins: ["http://localhost/*"]};
      chrome.permissions.request(perms).then((result) => {
        result && showMessage(`已授予本地伺服器存取權限`);
      });
    }
  }

  async function onClick(event) {
    try {
      const id = event.target.id;

      const handler = onClick.handlers[id];
      if (!handler) {
        throw new Error(`找不到對應的處理函數: ${id}`);
      }

      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

      await handler(tab);
    } catch (ex) {
      console.error(ex);
      showMessage("發生錯誤: " + ex.message, 'error');
    }
  }

  Object.assign(onClick, {
    handlers: {
      'copy-value'(tab) {
        return copyDataFromTab(tab);
      },
      'paste-value'(tab) {
        return pasteDataToTab(tab);
      },
      'clear-value'(tab) {
        return clearData();
      },
    },
  });

  function onLoaded() {
    document.querySelector('header').addEventListener('click', onClickHeader);
    for (const elem of document.querySelectorAll('#wrapper button[id]')) {
      elem.addEventListener('click', onClick);
    }
  }

  document.addEventListener('DOMContentLoaded', onLoaded);

  const action = {
    showMessage,
    copyDataFromTab,
    pasteDataToTab,
    clearData,
  };

  return action;
}));
