/*

    OldContainer

    iecontainer.html used to be the container URL, and a lot of existing customers have bookmarked
    it.  So we keep it there but just have it redirect to the correct new container.

 */
var OldContainer = {
    init: function() {
        var regex = /[^#]*#url=(.*)/;
        var match = document.location.href.match(regex);
        var url = decodeURIComponent(match[1]);

        chrome.runtime.getBackgroundPage(function(theBW) {
            var Background = theBW.Background;
            var newContainer = '';

            if (Background.useNativeHost()) {
                newContainer = Background.getNativeHostContainer(url);
            } else {
                newContainer = Background.getNPAPIContainer(url);
            }
            window.top.location = newContainer;
        }.bind(this));
    }
}

OldContainer.init();