/*
*    addressbar.js
*
*    Handles functionality for the address bar in the container page
*
 */
var AddressBar = {
    onAddressEnter: function() {
        // Navigate the top frame so this navigation gets into the history and the
        // back / forward queue
        var url = $('#address-box').val();
        NativeHostContainer.navigateContainer(url);
    },

    onReturnToChrome: function() {
        NativeHostContainer.onReturnToChrome();
    },

    onBookmark: function() {
        var doAdd = function(id) {
            chrome.bookmarks.create({ parentId: id, title: document.title, url: window.location.href });
        }

        chrome.bookmarks.getChildren("1", function(result) {
            var idIETab = null;
            for(var i=0; i<result.length; i++) {
                if(result[i].title == "IE Tab") {
                    idIETab = result[i].id;
                    break;
                }
            }
            if(idIETab) {
                // We have it, go ahead and add it.
                doAdd(idIETab);
            } else {
                // Create the IE Tab folder, and create the bookmark when that is complete
                chrome.bookmarks.create({ parentId: "1", title: "IE Tab" }, function(node) {
                    if(node) {
                        doAdd(node.id);
                    }
                });
            }
        });
    },


    addEventListeners: function() {
        $('#address-box').keypress(function(e) {
            if(e.which == 13) {
                this.onAddressEnter();
            }
        }.bind(this));

        $('#go-btn-anchor').click(function(e) {
            this.onAddressEnter();
            e.preventDefault();
        }.bind(this));

        $('#address-box').focus(function() {
            window.setTimeout(function() {
                $('#address-box').select();
            }, 100);
        });

        $('#bookmark').click(function(e) {
            this.onBookmark(this);
            e.preventDefault();
        }.bind(this));

        $('#close-btn').click(function(e) {
            this.onReturnToChrome();
            e.preventDefault();
        }.bind(this));
    },

    init: function() {
        this.BW = chrome.extension.getBackgroundPage();
        window.Background = this.BW.Background;
        window.Settings = this.BW.Settings;

        if (Settings.get('license-key')) {
            $('#btn-docs').attr('href', 'http://www.ietab.net/ie-tab-documentation?key=1');
        }
        this.addEventListeners();
    }
}

AddressBar.init();
