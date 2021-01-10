import { Component } from 'react';
import { storage, getNativeAPI } from '../../helpers/webext';
import { Mode, Action, defaultBlacklist, defaultWhitelist, defaultSchedule, unblockOptions, defaultUnblockOnceTimeout } from '../../helpers/block';
import { hasValidProtocol, getValidUrl, getHostName } from '../../helpers/url';
import { regex } from '../../helpers/regex';
import { inTime } from '../../helpers/time';
import { inToday } from '../../helpers/date';

const nativeAPI = getNativeAPI();

export default class Background extends Component {

  constructor(props) {
    super(props);
    // public
    this.blacklist = [];
    this.whitelist = [];
    this.isEnabled = false;
    this.mode = Mode.blacklist;
    this.action = Action.blockTab;
    this.redirectUrl = '';
    this.schedule = defaultSchedule;
    this.unblockOnceTimeout = defaultUnblockOnceTimeout;
    // private
    this.enableLock = false;
    this.tmpAllowed = [];

    this.init();
  }

  log = (message, ...params) => {
    //console.log(message, ...params); // enable/disable this line to see logs
  }

  //----- Start getters & setters (for public properties)

  setSchedule = (value) => {
    this.schedule = value;
  }

  getSchedule = () => {
    return this.schedule;
  }

  setMode = (value) => {
    this.mode = value;
  }

  getMode = () => {
    return this.mode;
  }

  setIsEnabled = (value) => {
    this.isEnabled = value;
    if (this.isEnabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  getIsEnabled = () => {
    return this.isEnabled;
  }

  setBlacklist = (blist) => {
    this.blacklist = this.transformList(blist);
  }

  getBlacklist = () => {
    return this.blacklist;
  }

  setWhitelist = (wlist) => {
    this.whitelist = this.transformList(wlist);
  }

  getWhitelist = () => {
    return this.whitelist;
  }

  setAction = (value) => {
    this.action = value;
  }

  getAction = () => {
    return this.action;
  }

  setRedirectUrl = (url) => {
    this.redirectUrl = getValidUrl(url);
  }

  getRedirectUrl = () => {
    return this.redirectUrl;
  }

  setUnblockOnceTimeout = (value) => {
    this.unblockOnceTimeout = value;
  }

  getUnblockOnceTimeout = () => {
    return this.unblockOnceTimeout;
  }

  //----- End getters & setters

  init = () => {
    storage.get({
      blacklist: defaultBlacklist,
      whitelist: defaultWhitelist,
      isEnabled: this.isEnabled,
      mode: this.mode,
      action: this.action,
      schedule: this.schedule,
      redirectUrl: this.redirectUrl
    }).then((items) => {
      this.log('items:', items);
      this.blacklist = this.transformList(items.blacklist);
      this.whitelist = this.transformList(items.whitelist);
      this.mode = items.mode;
      this.action = items.action;
      this.schedule = { ...this.schedule, ...items.schedule }; // merge
      this.redirectUrl = getValidUrl(items.redirectUrl);
      this.isEnabled = items.isEnabled;
      if (this.isEnabled) {
        this.enable();
      }
    });
    browser.runtime.onStartup.addListener(this.onBrowserStartup);
    browser.runtime.onMessage.addListener(this.handleMessage);
  }

  transformList = (list) => {
    return list.map(url => regex.wildcard(url)).map(url => regex.new(url));
  }

  onBrowserStartup = () => {
    storage.get({
      enableOnBrowserStartup: false
    }).then(({ enableOnBrowserStartup }) => {
      if (enableOnBrowserStartup) {
        this.enable('enabled on startup!');
      }
    });
  }

  handleMessage = (request, sender, sendResponse) => {
    this.log('Handle message:', request);
    let response = null;
    return new Promise(resolve => {
      switch (request.message) {
        // unblockSenderTab
        case 'unblockSenderTab':
          const { url, option, time = 0 } = request.params[0];
          switch (option) {
            case unblockOptions.unblockForWhile:
              this.tmpAllowed.push({
                time: time * 60000, // convert to ms
                startedAt: new Date().getTime(),
                hostname: getHostName(url)
              });
              break;
            case unblockOptions.unblockOnce:
            default:
              this.tmpAllowed.push({
                once: true,
                hostname: getHostName(url)
              });
              break;
          }
          response = this.redirectTab(sender.tab.id, url);
          break;
        // redirectSenderTab
        case 'redirectSenderTab':
          response = this.redirectTab(sender.tab.id, ...request.params);
          break;
        // default
        default:
          response = this.isFunction(request.message) ? this.executeFunction(request.message, ...request.params) : this[request.message];
          break;
      }
      resolve({ response });
    });
  }

  isFunction = (functionName) => {
    return this[functionName] && typeof this[functionName] === 'function';
  }

  executeFunction = (functionName, ...params) => {
    try {
      if (params) {
        return this[functionName](...params);
      } else {
        return this[functionName]();
      }
    } catch (error) {
      this.log(error);
    }
  }

  handleAction = (data) => {
    switch (this.action) {
      case Action.blockTab:
      case Action.redirectToUrl:
        return {
          redirectUrl: this.action === Action.redirectToUrl && this.redirectUrl.length ? (
            this.redirectUrl
          ) : (
            `${browser.runtime.getURL('index.html')}#blocked?url=${encodeURIComponent(data.url)}`
          )
        };
      case Action.closeTab:
        this.closeTab(data.tabId);
        return {
          redirectUrl: 'javascript:window.close()'
        };
    }
  }

  closeTab = (tabId) => {
    this.log('closing tab:', tabId);
    nativeAPI.tabs.remove(tabId); // nativeAPI is used to fix weird errors on chrome due to browser-polyfill
  }

  redirectTab = (tabId, redirectUrl) => {
    this.log('redirecting tab:', tabId, redirectUrl);
    nativeAPI.tabs.update(tabId, {
      url: redirectUrl
    });
  }

  removeOutdatedTmpAllowed = () => {
    const now = new Date().getTime();
    this.tmpAllowed = this.tmpAllowed.filter(allowed => {
      if (allowed.once) {
        return true;
      }
      if (now > allowed.startedAt + allowed.time) {
        return false;
      } else {
        return true;
      }
    });
  }

  isTmpAllowed = (url) => {
    if (this.tmpAllowed.length) {
      this.removeOutdatedTmpAllowed();
      const hostname = getHostName(url);
      const index = this.tmpAllowed.map(allowed => allowed.hostname).indexOf(hostname);
      if (index !== -1) {
        this.log('tmp allowed:', url);
        if (this.tmpAllowed[index].once) {
          setTimeout(() => {
            this.tmpAllowed.splice(index, 1);
          }, this.unblockOnceTimeout * 1000);
        }
        return true;
      }
    }
    this.log('not tmp allowed:', url);
    return false;
  }

  isBlacklisted = (url) => {
    if (this.isTmpAllowed(url)) {
      return false;
    }
    for (const rule of this.blacklist) {
      if (rule.test(url)) {
        this.log('is blacklisted:', url);
        return true;
      }
    }
    this.log('not blacklisted:', url);
    return false;
  }

  isWhitelisted = (url) => {
    if (this.isTmpAllowed(url)) {
      return true;
    }
    for (const rule of this.whitelist) {
      if (rule.test(url)) {
        this.log('is whitelisted:', url);
        return true;
      }
    }
    this.log('not whitelisted:', url);
    return false;
  }

  parseUrl = (data, caller) => {
    this.log('parsing url:', {
      caller: caller,
      data: data,
      mode: this.mode,
      blacklist: this.blacklist,
      whitelist: this.whitelist
    });
    // Handle schedule
    if (this.schedule.isEnabled) {
      try {
        if (!inToday(this.schedule.days)) {
          this.log('not in schedule days:', this.schedule.days);
          return;
        } else {
          const [startHour, startMinute] = this.schedule.time.start.split(':');
          const start = Number(startHour) * 60 + Number(startMinute);
          const [endHour, endMinute] = this.schedule.time.end.split(':');
          const end = Number(endHour) * 60 + Number(endMinute);
          if (start && !inTime(start, end)) {
            this.log('not in schedule time:', this.schedule.time);
            return;
          }
        }
      } catch (error) {
        this.log(error);
      }
    }
    // Handle blocking
    switch (this.mode) {
      case Mode.blacklist:
        if (this.isBlacklisted(data.url)) {
          return this.handleAction(data);
        }
        break;
      case Mode.whitelist:
        if (!this.isWhitelisted(data.url)) {
          return this.handleAction(data);
        }
        break;
    }
  }

  onBeforeRequestHandler = (requestDetails) => {
    return this.parseUrl(requestDetails, 'onBeforeRequestHandler'); // redirect will be handled by the event listener
  }

  onUpdatedHandler = (tabId, changeInfo, tab) => {
    if (changeInfo.url && hasValidProtocol(changeInfo.url)) {
      const results = this.parseUrl({ ...changeInfo, tabId: tabId }, 'onUpdatedHandler');
      if (results && results.redirectUrl) {
        this.redirectTab(tabId, results.redirectUrl);
      }
    }
  }

  onReplacedHandler = (addedTabId, removedTabId) => {
    browser.tabs.get(addedTabId).then((tab) => {
      if (tab) {
        const results = this.parseUrl({ url: tab.url, tabId: tab.id }, 'onReplacedHandler');
        if (results && results.redirectUrl) {
          this.redirectTab(tab.id, results.redirectUrl);
        }
      }
    });
  }

  enableEventListeners = () => {
    browser.webRequest.onBeforeRequest.addListener(this.onBeforeRequestHandler, {
      urls: ['*://*/*'],
      types: ['main_frame', 'sub_frame']
    }, ["blocking"]);
    browser.tabs.onUpdated.addListener(this.onUpdatedHandler);
    browser.tabs.onReplaced.addListener(this.onReplacedHandler);
  }

  disableEventListeners = () => {
    browser.webRequest.onBeforeRequest.removeListener(this.onBeforeRequestHandler);
    browser.tabs.onUpdated.removeListener(this.onUpdatedHandler);
    browser.tabs.onReplaced.removeListener(this.onReplacedHandler);
  }

  enable = (logMessage = 'enabled!') => {
    if (this.enableLock) {
      this.log('already enabled!', {
        enableLock: this.enableLock
      });
    } else {
      this.enableEventListeners();
      this.log(logMessage);
      this.enableLock = true;
    }
  }

  disable = (logMessage = 'disabled!') => {
    if (this.enableLock) {
      this.disableEventListeners();
      this.log(logMessage);
      this.enableLock = false;
    } else {
      this.log('already disabled!', {
        enableLock: this.enableLock
      });
    }
  }

  render() {
    return (
      <span>Silence is golden!</span>
    );
  }

}
