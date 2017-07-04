//
// RedirPage script for redir.htm
//
// This is a web-accessible resource that is used as a way to redirect
// auto URLs to the nhc.htm landing page.
//
// We want to keep nhc.htm NON web_accessible and still use a friendly URL.
//
// But redir.htm IS web_accessible.  We keep it from being used arbitrarily by
// only allowing it to open specific URLs that were registered for a short-lived
// time with a random identifier, so only auto URLs that we initiated can be opened
// with redir.htm.
//
var RedirPage = {
    extractChildUrl: function() {
        var regex = /[#]urlid=([^&].*)/;
        var match = document.location.href.match(regex);
        if (match) {
            // See if this is a pending Auto URL
            var autoUrl = Background.pendingAutoUrls[match[1]];
            if (autoUrl) {
                // Yup, looks good.
                return autoUrl;
            }
        }
        return null;
    },

    onUrlChanged: function() {
        var url = this.extractChildUrl();
        if (url) {
            var containerUrl = Background.getNativeHostContainer(url);
            window.location.replace(containerUrl);
        } else {
            document.getElementById('problem').style.display = 'block';
        }
    },

    init: function() {
        this.BW = chrome.extension.getBackgroundPage();
        window.Background = this.BW.Background;
        window.Settings = this.BW.Settings;

        window.onhashchange = function() {
            this.onUrlChanged();
        }.bind(this);

        // First check for the urlid
        this.onUrlChanged();
    }
}

RedirPage.init();
