/*
 * nathost_container.js
 *
 * Script for the container that will use the Native Host for rendering the WebBrowser control.
 *
*/

var NativeHostContainer = {
    BW: null,  // The background window
    windowId: null,
    tabId: null,
    isAttached: false,
    realTitle: '',
    hostName: '',
    hostWindowId: null,
    hideAddressBar: false,
    beforeUnloadActive: false,
    helperVersion: null,
    helperSupportsHistory : false,
    port: null,
    includeWithAll: null,

    ATTACH_RETRY_TIMEOUT: 50,
    DISCONNECT_MESSAGE_WAIT: 3000,  // Don't show the disconnect message right away

    // BACK/FWD SUPPORT
    nextPageId: 1,
    currentPage: 0,
    historyId: 1,

    // We have a resize delay to deal with an obscure case:
    //    If you zoom in on the container page, you get the resize before
    //    the page has fully repainted.  So the anchor color line is still on the screen
    //    and we find it at the old location, thus we end up positioning the IE window
    //    where it WAS, not where it currently is.  You can see this by zooming the address
    //    bar out and then it happens when you zoom back in.
    RESIZE_DELAY: 50,

    ONE_DAY_MS: 1000 * 3600 * 24,

    buildContainerUrl: function(childUrl, popupInfo) {
        var containerPage = 'nhc.htm';
        var containerUrl = chrome.extension.getURL(containerPage);
        if (popupInfo) {
            containerUrl += '#p=' + encodeURIComponent(JSON.stringify(popupInfo)) + '&';
        } else {
            containerUrl += '#';
        }
        containerUrl += 'url=' + childUrl;
        return containerUrl;
    },

    navigateContainer: function(childUrl, replaceEntry) {
        // navigateContainer is called by the address bar
        this.currentPage = this.nextPageId++;
        history.pushState({ page: this.currentPage, historyId: this.historyId }, "", this.buildContainerUrl(childUrl));
        this.navigateHost(childUrl);
    },

    extractChildUrl: function() {
        var regex = /[#&]url=([^&].*)/;
        var url = document.location.href.toString();
        var match = url.match(regex);
        if(match) {
            return match[1];
        } else {
            return 'about:blank';
        }
    },

    updateAddressBar: function() {
        var url = this.extractChildUrl();
        $('#address-box').val(url);
    },

    handleResize: function() {
        window.setTimeout(function() {
            var msgResize = {
                type: 'RESIZE',
                innerWidth: this.getIEWidth(),
                innerHeight: this.getIEHeight()
            };
            this.postNativeMessage(msgResize);
        }.bind(this), this.RESIZE_DELAY);
    },

    restoreTitle: function() {
        document.title = this.realTitle;
    },

    removePopupInfoFromAddress: function() {
        // We only need popup info when we first attach.  Once the attach is successful
        // we can remove the popup info so a refresh will work.
        var newUrl = this.buildContainerUrl(this.extractChildUrl());
        history.replaceState({ page: this.currentPage, historyId: this.historyId }, "", newUrl);
    },

    // Called when they click the 'X' button
    onReturnToChrome: function() {
        window.top.location = this.extractChildUrl();
    },

    onBookmark: function() {
    },

    navigateHost: function(url) {
        if (!url) {
            url = this.extractChildUrl();
        }
        this.replaceNextNav = true;
        this.postNativeMessage({ type: 'NAVIGATE', url: url  });
    },

    sendOptions: function() {
        var msg = {
            type: 'OPTIONS',
            options: {
                'autourl-list':         Settings.get('autourl-list'),
                'exclusion-list':       Settings.get('exclusion-list'),
                'enable-chrome-popups': Settings.get('enable-chrome-popups'),
                'only-auto-urls':       Settings.get('only-auto-urls'),
                'never-open-exceptions':Settings.get('never-open-exceptions'),
                'enable-dep':           Settings.get('enable-dep'),
                'enable-atl-dep':       Settings.get('enable-atl-dep'),
                'show-status-text':     Settings.get('show-status-text'),
                'enable-direct-invoke': Settings.get('enable-direct-invoke'),
                'favicon':              Settings.get('favicon'),
                'beforeunload':         Settings.get('beforeunload'),
                'ietab-header':         Settings.get('ietab-header'),
                'single-session':       Settings.get('single-session'),
                'shared-process':       this.useSharedProcess()
            }
        }
        this.postNativeMessage(msg);
    },

    sendNativeMessage: function(msg, fnResponse) {
        if (!this.port) {
            return;
        }

        if (this.includeWithAll) {
            msg = $.extend(msg, this.includeWithAll);
        }

        this.port.sendMessage(msg, fnResponse);
    },

    postNativeMessage: function(msg) {
        if (!this.port) {
            return;
        }

        if (this.includeWithAll) {
            msg = $.extend(msg, this.includeWithAll);
        }

        this.port.postMessage(msg);
    },

    setIncludeWithAll: function(params) {
        this.includeWithAll = $.extend({}, params);
    },

    getIEWidth: function() {
        return Math.floor(window.innerWidth * window.devicePixelRatio);
    },

    getIEHeight: function() {
        var topHeight = this.hideAddressBar ? 1 : $('#address-bar')[0].offsetHeight;

        return Math.floor( (window.innerHeight - topHeight) * window.devicePixelRatio );
    },

    tryAttach: function() {
        if (this.isAttached) {
            return;
        }
        // Check whether we are the active tab
        chrome.tabs.getCurrent(function(tab) {
            // We can't attach if we don't have a window id or aren't active
            if (!tab.active || !this.windowId) {
                this.restoreTitle();
                return;
            }

            // Remember the title change is asynchronous, so don't keep changing it or the helper
            // will never find it.  We may have to retry several times to find the window after
            // a single title change
            if (document.title.indexOf('ietaba:') == -1) {
                this.realTitle = document.title;
                document.title = 'ietaba:' + Background.getNextIETabId();
            }

            var msg = {
                type: 'ATTACH',
                tabTitle: document.title,
                innerWidth: this.getIEWidth(),
                innerHeight: this.getIEHeight()
            }
            this.postNativeMessage(msg);
        }.bind(this));
    },

    openNewWindow: function(url, features, popupInfo, forceChrome, forceTab) {
        // If the full-window option is on or there are no features then use a full window
        var fullWindow = Settings.get('enable-use-full-window-popups') || !features;

        var openInChrome = forceChrome;
        if (!openInChrome) {
            // Open in Chrome if the only-auto-urls value is set and this is not an auto URL
            openInChrome = Settings.get("only-auto-urls") && !Background.isAutoURL(url);
            // With exception for about:blank
            openInChrome = openInChrome && (url != 'about:blank');

            // Also check for "never-open-exceptions"
            openInChrome = openInChrome || (Settings.get('never-open-exceptions') && Background.isAutoURLException(url));
        }

        if (!openInChrome) {
            // If it's a popup, check whether to hide the location bar
            if (features && ( (features.indexOf('location=no')!=-1) || (features.indexOf('location=0')!=-1))) {
                popupInfo.hideAddressBar = true;
            }
            // Store the popup info so the popup can find it
            url = this.buildContainerUrl(url, popupInfo);
        }

        // See if we should just open the pop-up in a tab
        var openInTab = forceTab || Settings.get('open-popups-in-tab');
        if (openInTab) {
            chrome.tabs.getCurrent(function(tab) {
                chrome.tabs.create({ url: url, active: true, index: tab.index+1 });
            });
            return;
        }

        // Build the window creation options
        var createOptions = {};
        if (fullWindow) {
            createOptions = { url: url };
        } else {
            // Find the options for creating the popup window
            var arrFeatures = features.split(',');
            createOptions = {
                url: url,
                focused: true,
                type: 'popup'
            }
            for (var i=0; i < arrFeatures.length; i++) {
                var parts = arrFeatures[i].split('=');
                if (typeof(parts[1]) == 'undefined')
                    continue;
                parts[0] = parts[0] && parts[0].trim();
                parts[1] = parts[1] && parts[1].trim();

                var value = parseInt(parts[1]);
                if (isNaN(value))
                    continue;
                switch(parts[0]) {
                    case 'left':
                    case 'right':
                    case 'top':
                        createOptions[parts[0]] = value;
                        break;
                    case 'width':
                        createOptions.width = value + 16;
                        break;
                    case 'height':
                        createOptions.height = value + 40;
                        break;
                }
            }
        }
        chrome.windows.create(createOptions);
    },

    setTitle: function(newTitle) {
        this.realTitle = newTitle;
        if (document.title.indexOf('ietaba:') == -1) {
            document.title = newTitle;
        }
    },

    onDisconnected: function() {
        // During shutdown, since the port was opened by the background page, it's possible
        // for the window object to be null here.
        if (window) {
            window.setTimeout(function() {
                $('#helper-disconnected').css('display', 'block');
            }, this.DISCONNECT_MESSAGE_WAIT);
        }
        this.port = null;
    },

    onScriptError: function(msg) {
        var text = '';
        if(msg['context'] == 'IE') {
            text = msg.context + ': ' + 'Error: ' + msg['errorMessage'] + '.  Source: ' + msg['errorUrl'] + ':' + msg['errorLine'];
        } else if(msg['context'] == 'IEC') {
            text = msg.context + ': ' + 'Error: ' + msg['description'] + ', line: ' + msg['lineNumber'];
        }
        console.error(text);
    },

    onLogMessage: function(msg) {
        var text = msg['context'] + ': ' + msg['message'];
        console.log(text);
    },

    onPostMessageToOpener: function(msg, targetOrigin) {
        if (window.opener)
            window.opener.postMessage(msg, targetOrigin);
    },

    onNativeMessage: function(msg, fnResponse) {
        // Only handle messages from our host window
        if (msg.hostWindowId && (msg.hostWindowId != this.hostWindowId)) {
            return;
        }

        switch(msg.type) {
            case 'TITLE_CHANGE':
                this.setTitle(msg.newTitle);
                break;
            case 'NAVIGATE_COMPLETE':
                if (this.replaceNextNav) {
                    history.replaceState({ page: this.currentPage, historyId: this.historyId }, "", this.buildContainerUrl(msg.url));
                } else {
                    this.currentPage = this.nextPageId++;
                    history.pushState({ page: this.currentPage, historyId: this.historyId }, "", this.buildContainerUrl(msg.url));
                }
                this.replaceNextNav = false;
                this.updateAddressBar();
                break;
            case 'FRAME_NAVIGATE_COMPLETE':
                // Always ignore a frame's first navigation which happens when the page is loaded, so it doesn't actually
                // contribute as a navigation in the history
                if (msg.firstNav)
                    break;

                if (this.replaceNextNav) {
                    history.replaceState({ page: this.currentPage, historyId: this.historyId }, "", "");
                } else {
                    // This is a new navigation in a frame which means the WB control can go "Back", so we add
                    // a new entry to the Chrome history.
                    this.currentPage = this.nextPageId++;
                    history.pushState({ page: this.currentPage, historyId: this.historyId }, "", "");
                }
                this.replaceNextNav = false;
                break;
            case 'NEW_WINDOW':
                this.openNewWindow(msg.url, msg.features, { hostName: this.hostName, hostWindowId: msg.popupHostWindowId }, msg.forceChrome, msg.forceTab);
                break;
            case 'RETURN_TO_CHROME':
                window.top.location = msg.url;
                break;
            case 'WINDOW_CLOSING':
                window.setTimeout(function() {
                    window.close();
                }, 300);
                break;
            case 'BEFORENAVIGATE2':
                this.showLoadingFavicon();
                break;
            case 'CMDLINE':
                console.log('CMDLINE = ' + msg.value);
                break;
            case 'ATTACH_SUCCESS':
                this.isAttached = true;
                this.restoreTitle();
                this.removePopupInfoFromAddress();
                break;
            case 'ATTACH_FAILED_METRO':
            case 'ATTACH_RETRY':
                window.setTimeout(function() {
                    this.tryAttach();
                }.bind(this), this.ATTACH_RETRY_TIMEOUT);
                break;
            case 'ATTACH_FAILED_CLOSED':
                if(this.popupInfo) {
                    // The popup host window may close itself before we attach, in which case we need
                    // to close this popup.
                    window.close();
                }
                break;
            case 'SEND_MESSAGE':
                chrome.runtime.sendMessage(msg.extensionId, JSON.parse(msg.message));
                break;
            case 'SCRIPT_ERROR':
                this.onScriptError(msg);
                break;
            case 'LOG_MESSAGE':
                this.onLogMessage(msg);
                break;
            case 'FAVICON_CHANGED':
                this.updateFavicon(msg.newFavicon);
                break;
            case 'UPDATE_BEFOREUNLOAD':
                this.beforeUnloadActive = msg.active;
                break;
            case 'POSTMESSAGE_TO_OPENER':
                this.onPostMessageToOpener(msg.msg, msg.targetOrigin);
                break;
            case 'NO_BACK':
                history.back();
                break;
        }
    },

    initHostWindow: function(fnContinue) {
        // If we have popup info, then we already have a host window
        if (this.popupInfo) {
            this.hostName = this.popupInfo.hostName;
            this.hostWindowId = this.popupInfo.hostWindowId;
            this.setIncludeWithAll({ hostWindowId: this.hostWindowId });
            fnContinue();
            return;
        }

        // Create a new host window.  It will initially be invisible.
        var anchorColor = this.hideAddressBar ? [ 0xad, 0xae, 0xad ] : [ 0x6b, 0x92, 0xe7 ];
        var msgCreate = {
            type: 'CREATE',
            anchorColor: anchorColor
        }
        // Get the perUrlMode if there is one
        var perUrlMode = Settings.getPerUrlMode(this.extractChildUrl());
        if (perUrlMode)
            msgCreate.perUrlMode = perUrlMode;

        this.sendNativeMessage(msgCreate, function(msgResult) {
            if (msgResult.type == 'CREATE_SUCCESS') {
                this.hostWindowId = msgResult.hostWindowId;
                this.setIncludeWithAll({ hostWindowId: this.hostWindowId });
                fnContinue();
            } else {
                // Treat this like we were disconnected.
                this.onDisconnected();
            }
        }.bind(this));
    },

    sendCookies: function(url, fnFinished) {
        // Send Chrome-sync'd cookies
        if (!Settings.get('cookie-sync')) {
            fnFinished();
            return;
        }
        chrome.cookies.getAll({ url: url }, function(cookies) {
            var cookieStrings = [];
            for (var i=0; i<cookies.length; i++) {
                var cookie = cookies[i];
                var str = cookie.name + '=' + cookie.value + '; path=' + cookie.path + '; domain=' + cookie.domain;
                if (!cookie.session && (typeof(cookie.expirationDate) != 'undefined')) {
                    var strDate = new Date(cookie.expirationDate * 1000);
                    str += '; expires=' + strDate.toUTCString();
                }
                if (cookie.httpOnly) {
                    str += '; httpOnly';
                }
                if (cookie.secure) {
                    str += '; secure';
                }
                cookieStrings.push(str);
            }

            var msgCookies = {
                type: 'COOKIES',
                url: url,
                cookies: cookieStrings
            }

            this.sendNativeMessage(msgCookies);
            fnFinished();
        }.bind(this));
    },

    tryHostForward: function() {
        this.replaceNextNav = true;
        this.sendNativeMessage({ type: 'TRY_FORWARD' });
    },

    tryHostBack: function() {
        this.replaceNextNav = true;
        this.sendNativeMessage({ type: 'TRY_BACK' });
    },

    finalInit: function() {
        // Supply the options
        this.sendOptions();

        // Listen for host messages
        this.fnPortListener = function(msg, fnResponse) {
            this.onNativeMessage(msg, fnResponse);
        }.bind(this);
        this.port.onMessage.addListener(this.fnPortListener);

        // Listen for activation changes which the helpers uses to hide/show the host window
        chrome.tabs.onActivated.addListener(function(activeInfo) {
            if (activeInfo.windowId != this.windowId) {
                return;
            }

            if (activeInfo.tabId != this.tabId) {
                this.postNativeMessage({ type: 'TABDEACTIVATED' });
            } else {
                this.postNativeMessage({ type: 'TABACTIVATED' });
                if (!this.isAttached) {
                    // We have to attach first
                    this.tryAttach();
                }
            }
        }.bind(this));

        // Tell the helper when we are detached so it can hide the window
        chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
            if (tabId != this.tabId) {
                return;
            }
            this.windowId = null;
            this.isAttached = false;
            console.log("Detached");
            this.postNativeMessage({ type: 'DETACH' });
        }.bind(this));

        // Tell the helper to re-attach to the new tab
        chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
            if (tabId != this.tabId) {
                return;
            }
            this.windowId = attachInfo.newWindowId;
            console.log('onAttached: ' + tabId);
            this.tryAttach();
        }.bind(this));

        window.onresize = this.handleResize.bind(this);
        // Handle focus change like resize.  We need this to fix the Z-Order on window restore, otherwise
        // the IE Tab window will end up behind the hidden hack RenderWidgetHostHWND and will be inactive.
        window.addEventListener('focus', function() {
            this.handleResize();
        }.bind(this), false);

        // Attach the host control to this window
        this.tryAttach();

        this.updateAddressBar();

        // History tracking help
        $(window).on( "popstate", function(event) {
            var state = event.originalEvent.state;
            if (!state || !this.helperSupportsHistory) {
                // No state, that means they navigated with a bookmark or entry in the address bar, so just
                // replace the state with our history info and  navigate the host
                this.currentPage = this.nextPageId++;
                history.replaceState({ page: this.currentPage, historyId: this.historyId }, "", "");
                this.navigateHost();
                return;
            }

            if (state.historyId != this.historyId) {
                // We popped a state from another instance of the WebBrowser control, so we
                // can't do a back or forward operation, just navigate the URL.
                // Also note that this invalidates our history tracking because we are adding a forward
                // entry to the WB control, but this could very well be from a Chrome back operation in Chrome.
                // So we reset the historyId to start over.
                this.historyId = this.getNewHistoryId();
                this.currentPage = this.nextPageId++;
                this.navigateHost();
            } else {
                // We popped a state that is form this instance of the WB control.   See if it is a FWD or BACK
                // and if so, use the WB control to perform the FWD or BACK, which enables us to capture and
                // use FWD/BACK for frame navigations.
                if(state.page < this.currentPage) {
                    this.currentPage = state.page;
                    this.tryHostBack();
                } else if (state.page > this.currentPage) {
                    this.currentPage = state.page;
                    this.tryHostForward();
                }
            }
        }.bind(this));

        if (!this.isPopup()) {
            this.currentPage = this.nextPageId++;
            history.replaceState({ page: this.currentPage, historyId: this.historyId }, "", "");
            this.navigateHost();
        }
    },

    initCurrentTab: function(fnContinue) {
        chrome.tabs.getCurrent(function(tab) {
            this.tabId = tab.id;
            this.windowId = tab.windowId;
            fnContinue();
        }.bind(this));
    },

    initNativeHost: function(fnContinue) {
        this.connectToHost(function(port) {
            if (port) {
                fnContinue();
            } else {
                var childUrl = this.extractChildUrl();
                var chromeVersion = { major: parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10) };
                var infoUrl = '/nativehostrequired.html#url=' + childUrl;
                if (chromeVersion.major < 34) {
                    infoUrl = '/nativehostrequired_msi.html#url=' + childUrl;
                }
                window.top.location = infoUrl;

            }
        }.bind(this));
    },

    getPopupInfo: function() {
        var regex = /[^#]*#p=([^&]*)/;
        var match = document.location.href.match(regex);
        if (!match)
            return null;

        var info = null;
        try {
            info = JSON.parse(decodeURIComponent(match[1]));
        } catch(ex) {}

        return info;
    },

    isPopup: function() {
        return !!this.getPopupInfo();
    },

    //
    // We have to wait for information about this popup from our Creator.  Tab is Great!
    //
    popupInit: function(fnCallback) {
        this.popupInfo = this.getPopupInfo();

        // Now we know whether the popup demands an address bar, also check the setting
        this.hideAddressBar = this.hideAddressBar || Settings.get('hide-addr-bar');
        // Hide the address bar before we do other initialization to avoid flicker
        if (this.hideAddressBar) {
            $('#address-bar').css('display', 'none');
            $('#no-address-bar-anchor').css('display', 'block');
        }

        fnCallback();
    },

    isPlatformSupported: function() {
        return (window.navigator.platform.toLowerCase().indexOf('win') == 0);
    },

    dealWithUnsupportedPlatform: function() {
        var url = 'http://www.ietab.net/notsupported';
        // Uninstall if it is less than 10 minutes old.  This takes care of uninstalling for recent
        // installs, but it doesn't uninstall for users who may inadvertently click the button
        // while on an unsupported platform (which uninstalls across all sync'd devices).
        var firstSeen = IETAB.Storage.get("firstSeen");
        if (firstSeen) {
            var age = (new Date()).getTime() - firstSeen;
            age = age / (1000 * 60);
            if (age < 10) {
                Background.uninstallSelf();
                url += '?uninstalled=1';
            }
        }
        window.top.location = url;
    },

    getDayString: function(time) {
        var date = new Date(time);
        return date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
    },

    didShowReminderToday: function() {
        var lastShown = IETAB.Storage.get('ab-regtest-lastshown');
        if (!lastShown) {
            return false;
        }
        var lastDay = this.getDayString(lastShown);

        var now = (new Date()).getTime();
        var thisDay = this.getDayString(now);

        return (thisDay == lastDay);
    },

    shouldShowRegReminder: function() {
        // Only show a reg reminder if they are in the regtest
        if (!IETAB.Storage.get('ab-regtest-1'))
            return false;

        // No reg reminder for users with a license of course!
        var key = Settings.get('license-key');
        if (key)
            return false;

        // Don't show a reg-reminder for 30 days.
        var now = (new Date()).getTime();
        var firstSeen = IETAB.Storage.get('firstSeen');
        if ( (now - firstSeen) < this.ONE_DAY_MS * 30)
            return false;

        // Finally, only show it if we didn't show one yet today
        return !this.didShowReminderToday();
    },

    shouldShowRegReminder3: function() {
        // Only show a reg reminder if they are in the regtest
        if (!IETAB.Storage.get('ab-regtest-3'))
            return false;

        // No reg reminder for users with a license of course!
        var key = Settings.get('license-key');
        if (key)
            return false;

        // If we've shown it 8 times, then we need to keep showing it because it is disabled
        // until they get a license
        var nShown = IETAB.Storage.get('ab-regtest-3-regcount');
        if (nShown > 7)
            return true;

        // If less than 8 times, then just show it once per day
        return !this.didShowReminderToday();
    },

    initRegReminder: function(testIndex) {
        // Update last-shown
        var now = (new Date()).getTime();
        IETAB.Storage.set('ab-regtest-lastshown', now);

        var strCount = 'ab-regtest-' + testIndex + '-regcount';
        // Update shown count
        var n = IETAB.Storage.get(strCount);
        if (!n) n = 0;
        n++;
        IETAB.Storage.set(strCount, n);

        // Set the count as a cookie on ietab.net
        var cookieExpire = now + (1000 * 3600 * 24 * 30 * 12);  // Expires in 12 months
        // Convert expiration to seconds
        cookieExpire = cookieExpire / 1000;
        chrome.cookies.set({
            url: 'http://www.ietab.net/',
            name: strCount,
            value: n.toString(),
            domain: '.ietab.net',
            expirationDate: cookieExpire
        });

        var nShown = IETAB.Storage.get('ab-regtest-3-regcount');
        var nRemaining = 8;
        if (nShown)
          nRemaining = nRemaining - nShown;

        var disableIETab = false;
        if (testIndex == 1) {
            $('#reg-reminder-1').css('display', 'block');
        } else if (testIndex == 3) {
            $('#reg-reminder-gpo').css('display', 'block');
            $('#stop-working').text(nRemaining + ((nRemaining >1) ? ' days' : ' day'));
            if (nRemaining <= 0) {
                disableIETab = true;
                $('.reg-reminder-header').text('IE Tab License Expired');
                $('.remind-later').css('display', 'none');
            }
        }
        $('.buy-now').click(function() {
            if (!disableIETab)
                this.initNormal();
        }.bind(this));
        $('.remind-later').click(function() {
            chrome.tabs.create({ url: 'http://www.ietab.net/pricing?fr=reglater', active: false });
            if (!disableIETab)
                this.initNormal();
        }.bind(this));
    },

    initNormal: function() {
        $('#reg-reminder2').css('display', 'none');

        if (!this.isPlatformSupported()) {
            this.dealWithUnsupportedPlatform();
            return;
        }

        var chromeVersion = { major: parseInt(window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1], 10) };
        if (chromeVersion.major < 29) {
            window.top.location = '/chrome-too-old.html';
            return;
        }

        this.setTitle(this.extractChildUrl());

        this.popupInit(function() {
            this.initNativeHost(function() {
                this.initCurrentTab(function() {
                    this.initHostWindow(function() {
                        this.sendCookies(this.extractChildUrl(), function() {
                            this.finalInit();
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    },

    sendEval: function(context, cmd) {
        var msg = {
            type: 'DO_EVAL',
            context: context,
            cmd: cmd
        }
        this.sendNativeMessage(msg);
    },

    useFavicon: function() {
        if (!Settings.get('favicon'))
            return false;

        var helperVersion = Settings.get('helper-version');
        return (Utils.dotVersionCompare(helperVersion, '9.7.12.1') >= 0);
    },

    useSharedProcess: function() {
        var helperVersion = Settings.get('helper-version');
        return Settings.get('shared-process') && (Utils.dotVersionCompare(helperVersion, '10.6.6.1') >= 0);
    },

    updateFavicon: function(newFavicon) {
        if (!this.useFavicon())
            return;

        if(this.lastFavicon == newFavicon)
            return;
        this.lastFavicon = newFavicon;

        // First, change to a blank one because if the new one doesn't exist then
        // Chrome will keep the previous one.  This way we get a blank one in the case
        // where one doesn't exist.
        favicon.change('images/default_favicon.ico');
        window.setTimeout(function() {
            // We use a timeout because on some versions of Chrome, the default favicon
            // doesn't stick if it isn't around long enough before changing it.
            favicon.change(newFavicon);
        }, 200);
    },

    initCommandSupport: function() {
        window.ie = {
            eval: function(cmd) {
                this.sendEval('IE', cmd);
            }.bind(this)
        }
        window.iec = {
            eval: function(cmd) {
                this.sendEval('IEC', cmd);
            }.bind(this)
        }
    },

    showLoadingFavicon: function() {
        if (!this.useFavicon())
            return false;

        this.lastFavicon = null;
        favicon.animate([
            "images/loading/image1.gif", "images/loading/image2.gif",
            "images/loading/image3.gif", "images/loading/image4.gif",
            "images/loading/image5.gif", "images/loading/image6.gif",
            "images/loading/image7.gif", "images/loading/image8.gif"
        ], 400);
    },

    onBeforePrint: function() {
        window.setTimeout(function() {
            this.sendNativeMessage( { type: 'ONBEFOREPRINT' });
        }.bind(this), 0);
    },

    getNewHistoryId: function() {
        return Math.floor(Math.random() * 1000000)
    },

    getHostNameForReals: function() {
        var perUrlMode = '';

        if (this.popupInfo) {
            return this.popupInfo.hostName;
        }

        // Either use the shared host name or a unique host name
        if (this.useSharedProcess()) {
            perUrlMode = Settings.getPerUrlMode(this.extractChildUrl());
            if (perUrlMode) {
                return 'shared-' + perUrlMode;
            } else {
                return 'shared';
            }
        }

        // Create a new, unique, host-name for every tab.
        // Yeah, 10,000,000 is arbitrary, but it's sufficiently large, and readable when debugging
        return Math.floor(Math.random() * 10000000);
    },

    getHostName: function() {
        // This hostName never changes for a tab
        if (this.hostName) {
            return this.hostName;
        } else {
            this.hostName = this.getHostNameForReals();
            return this.hostName;
        }
    },

    connectToHost: function(fnResponse) {
        NativeHostManager.getNativeHostPort(this.getHostName(), function(port) {
            this.port = port;
            if (port) {
                port.onDisconnect.addListener(function() {
                    this.onDisconnected();
                }.bind(this));
            }
            fnResponse(port);
        }.bind(this));
    },

    onUnload: function() {
        if (this.fnPortListener && this.port) {
            this.sendNativeMessage({ type: 'PAGE_UNLOADED' });
            this.port.onMessage.removeListener(this.fnPortListener);
            this.port = null;
            this.fnPortListener = null;
        }
    },

    init: function() {
        this.historyId = this.getNewHistoryId();
        this.helperVersion = Settings.get('helper-version');
        this.helperSupportsHistory = (Utils.dotVersionCompare(this.helperVersion, '10.3.32.1') >= 0);
        this.showLoadingFavicon();

        this.BW = chrome.extension.getBackgroundPage();
        window.Background = this.BW.Background;
        window.Settings = this.BW.Settings;
        window.NativeHostManager = this.BW.NativeHostManager;

        this.initCommandSupport();

        window.addEventListener('unload', function() {
            this.onUnload();
        }.bind(this), true);

        chrome.runtime.onMessage.addListener(function(message) {
            switch(message.type) {
                case 'AUTH_REQUESTED':
                    this.postNativeMessage({ type: 'TABDEACTIVATED' });
                    break;
                case 'GET_URL_PROCESS_INFO':
                    var msg = { type: 'URL_PROCESS_INFO' };
                    msg.url = $('#address-box').val();
                    msg.processId = this.port._processId;
                    chrome.runtime.sendMessage(msg);
                    break;
                case 'DUMP_WINDOWS':
                    this.postNativeMessage({ type: 'DUMP_WINDOWS' });
                    break;
            }
        }.bind(this));

        chrome.runtime.onMessageExternal.addListener(function(message, sender) {
            if (sender && sender.id) {
                this.postNativeMessage({ type: 'MESSAGE_EXTERNAL', sender: sender.id, message: JSON.stringify(message) });
            }
        }.bind(this));

        window.addEventListener('beforeunload', function(e) {
            if(this.beforeUnloadActive) {
                e.returnValue = '';
                return '';
            }

        }.bind(this), false);

        // Catch print requests so they can be redirected to IE
        var mediaQuery = window.matchMedia && window.matchMedia('print');
        if (mediaQuery) {
            mediaQuery.addListener(function(mql) {
                if (mql && mql.matches) {
                    this.onBeforePrint();
                }
            }.bind(this));
        }

        if (this.shouldShowRegReminder()) {
            this.initRegReminder(1);
        } else if (this.shouldShowRegReminder3()) {
            this.initRegReminder(3);
        } else {
            this.initNormal();
        }
    }
}

window.onload = function() {
    NativeHostContainer.init();
}
