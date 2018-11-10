(function() {
    "use strict";
    var bgpage = browser.extension.getBackgroundPage();

    function init() {
        setText("app_name", browser.i18n.getMessage("appName"));
        setText("main_settings_tooltip", browser.i18n.getMessage("main_settings_tooltip"));
        setText("main_add_blacklist_tooltip", bgpage.getIsWhitelistMode() ? browser.i18n.getMessage("main_add_whitelist_tooltip") : browser.i18n.getMessage("main_add_blacklist_tooltip"));
        setText("main_status", browser.i18n.getMessage("main_status"));
        setText("main_mode", browser.i18n.getMessage("main_mode"));
        setText("mode_blacklist_title", browser.i18n.getMessage("settings_blacklist_title"));
        setText("mode_whitelist_title", browser.i18n.getMessage("settings_whitelist_title"));
        browser.tabs.query({
            active: true,
            lastFocusedWindow: true
        }, function(tabs) {
            var tab = tabs[0];
            var isWhitelistMode = bgpage.getIsWhitelistMode();
            if (!bgpage.canAccessTab(tab) || (!isWhitelistMode && bgpage.isBlacklisted(tab)) || (isWhitelistMode && bgpage.isWhitelisted(tab))) {
                addClass(document.getElementById("add-to-blacklist-icon"), "hidden");
            }
        });
    }

    window.addEventListener("click", function(event) {
        var t = event.target;
        if (t.id == "add-to-blacklist-icon" && hasClass(t, "buttons")) {
            browser.tabs.query({
                active: true,
                lastFocusedWindow: true
            }, function(tabs) {
                var tab = tabs[0];
                var parserA = document.createElement("a");
                parserA.href = tab.url;
                var host = parserA.hostname;
                if (host != null) {
                    if (bgpage.getIsWhitelistMode()) {
                        browser.storage.local.get({
                            whiteList: bgpage.getDefaultWhitelist()
                        }, function(items) {
                            var whitelist = items.whiteList;
                            for (var index in whitelist) {
                                if (whitelist[index].indexOf(host) >= 0) {
                                    return;
                                }
                            }
                            whitelist.splice(0, 0, host);
                            bgpage.setWhitelist(whitelist);
                            browser.storage.local.set({
                                whiteList: whitelist
                            }, function() {});
                        })
                    } else {
                        browser.storage.local.get({
                            blackList: bgpage.getDefaultBlacklist()
                        }, function(items) {
                            var blacklist = items.blackList;
                            for (var index in blacklist) {
                                if (blacklist[index].indexOf(host) >= 0) {
                                    return;
                                }
                            }
                            blacklist.splice(0, 0, host);
                            bgpage.setBlacklist(blacklist);
                            browser.storage.local.set({
                                blackList: blacklist
                            }, function() {});
                        })
                    }
                }
            });
            var atbIcon = document.getElementById("add-to-blacklist-icon");
            removeClass(atbIcon, "buttons");
            setTimeout(function() {
                addClass(atbIcon, "convergeToPoint");
                setTimeout(function() {
                    addClass(atbIcon, "checked");
                    removeClass(atbIcon, "convergeToPoint");
                    setTimeout(function() {
                        addClass(atbIcon, "convergeToPoint");
                        setTimeout(function() {
                            addClass(atbIcon, "hidden");
                            removeClass(atbIcon, "checked");
                            removeClass(atbIcon, "convergeToPoint");
                            addClass(atbIcon, "buttons");
                        }, 200)
                    }, 500)
                }, 200)
            }, 100);
        }
        if (t.id == "setting-icon") {
            setTimeout(function() {
                browser.runtime.openOptionsPage(null);
                window.close();
            }, 100);
        }
    }, false);

    window.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        return false;
    }, true);

    window.onload = init;
})();
