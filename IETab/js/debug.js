/*
 * debug.js
 *
 * Handles debug logging.  Note that we don't use "Settings" for this because we might need
 * logging to debug settings issues.
 *
*/
var Debug = {
    log: function(text) {
        if (!this.isEnabled())
            return;

        function zp(n) {
            return (n < 10 ? '0' : '') + n;
        }
        var date = new Date();
        var prefix = zp(date.getHours()) + ':' + zp(date.getMinutes()) + ':' + zp(date.getSeconds()) + ' - ';
        console.log(prefix + text);
    },

    disable: function() {
        this.log('Logging is now disabled.  Last Message');
        delete localStorage['enableDebug'];
    },

    enable: function() {
        this.log('Logging is now enabled');
        localStorage['enableDebug'] = 1;
    },

    isEnabled: function() {
        return localStorage['enableDebug'];
    },

    init: function() {
        var self = this;
        this.log('Logging is enabled');
        chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
            var updateUrl = false;

            if (changeInfo.url == 'chrome://ietab_enabledebug/') {
                self.enable();
                updateUrl = 'http://www.ietab.net/debug?enabled=1';
            } else if(changeInfo.url == 'chrome://ietab_disabledebug/') {
                self.disable();
                updateUrl = 'http://www.ietab.net/debug?enabled=0';
            }

            if (updateUrl) {
                window.setTimeout(function() {
                    chrome.tabs.update(tab.id, { url: updateUrl });
                }, 1000);
            }
        })
    }
}

Debug.init();