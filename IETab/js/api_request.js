var ApiRequestPage = {
    BP: null,
    Background: null,
    IETabApi: null,
    retryCount: 0,

    init2: function() {
        var regex = /.*\?rid=([0-9]+)/;
        var match = document.location.href.match(regex);
        if (!match) {
            window.close();
            return;
        }
        var requestId = match[1];
        var requestWindow = this.IETabApi.apiRequestWindows[requestId];
        if (!requestWindow) {
            // The background page may not have initialized the apiRequestWindow params yet,
            // try again in 100ms
            window.setTimeout(function() {
                this.retryCount++;
                if (this.retryCount > 5) {
                    window.close();
                    return;
                }
                this.init2();
            }.bind(this), 100);
        }
        // Get the host from the URL
        var hostName = Utils.parseUrl(requestWindow.requestingUrl).hostname;
        $('#website').text(hostName);

        // Simulate modality by stealing the focus back from the parent window
        chrome.windows.onFocusChanged.addListener(function(windowId) {
            if (windowId == requestWindow.parentWindowId) {
                window.setTimeout(function() {
                    chrome.windows.update(requestWindow.windowId, { focused: true });
                }, 100);
            }
        }.bind(this));

        window.setTimeout(function() {
            var bodyHeight = document.body.scrollHeight;
            var diffHeight = window.outerHeight - window.innerHeight;

            chrome.windows.update(requestWindow.windowId, { height: bodyHeight + diffHeight });
        }, 0);

        $('#btnNo').click(function() {
            this.IETabApi.onApiRequestResult(requestId, false, $('#dontask').is(':checked'));
        }.bind(this));
        $('#btnYes').click(function() {
            this.IETabApi.onApiRequestResult(requestId, true, $('#dontask').is(':checked'));
        }.bind(this));
    },

    init: function() {
        chrome.runtime.getBackgroundPage(function(bp) {
            this.BP = bp;
            this.Background = bp.Background;
            this.IETabApi = bp.IETabApi;

            this.init2();
        }.bind(this));
    }
}

ApiRequestPage.init();
