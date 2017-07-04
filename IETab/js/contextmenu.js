/*
 * contextmenu.js
 *
 * Context menu support
 *
*/
var ContextMenu = {
    init: function(theBP) {
        function onContextClicked(info, tab) {
            var url = info.linkUrl || info.srcUrl || info.frameUrl || info.pageUrl || tab.url;
            switch(info.menuItemId) {
                case contextOpenIETab:
                    theBP.openWithIETab(null, url);
                    break;
                case contextOpenSameTab:
                    theBP.openWithIETab(tab.id, url);
                    break;
                case contextOptions:
                    theBP.onShowNormalOptions();
                    break;
            }
        };

        var contextParent = chrome.contextMenus.create({ type: "normal",  title: I18N("ctxIETabOptions"), contexts: ['all'], onclick: onContextClicked });
        var contextOpenIETab = chrome.contextMenus.create({ type: "normal", title: I18N("ctxOpenIETab"), contexts: ['all'], parentId: contextParent, onclick: onContextClicked });
        var contextOpenSameTab = chrome.contextMenus.create({ type: "normal", title: I18N("ctxOpenInCurrentTab"), contexts: ['all'], parentId: contextParent, onclick: onContextClicked });
        var contextOptions = chrome.contextMenus.create({ type: "normal", title: I18N("ctxOptions"), contexts: ['all'], parentId: contextParent, onclick: onContextClicked });
    }
}
