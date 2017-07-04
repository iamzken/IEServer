/*
*    utils.js
*
*    Generic helper functions
*
 */
var Utils = {
    //  dotVersionCompare
    //
    //  Similar to strcmp, a > b = +1, a == b = 0, a < b = -1
    //
    dotVersionCompare: function(a, b) {
        // Convert undefined to 0
        if (!a) a = "0";
        if (!b) b = "0";

        // Parse into version parts
        var parts = {};
        parts.a = a.split(".");
        parts.b = b.split(".");

        for(var i=0; i < parts.a.length; i++) {
            // If we were equal so far and we reached the end of b, then a is bigger
            if(parts.b.length <= i) return 1;

            // Equal so far, integer compare in the same location
            var na = parseInt(parts.a[i]);
            var nb = parseInt(parts.b[i]);
            if(na < nb) return -1;
            else if(na > nb) return 1;
        }

        // We reached the end of 'a'.  If we also reached the end of 'b', then
        // they are equal.  Otherwise, 'b' is longer.  And greater.
        if(i == parts.b.length) return 0;
        else return -1;
    },

    getFileContent: function(fileName, asBase64, fnResponse) {
        var xhr = new XMLHttpRequest();
        var url = chrome.extension.getURL(fileName);
        // Unfortunately, we have to use asynch XHR even for a local file because otherwise
        // Chrome won't allow you to set the responseType.
        xhr.open('GET', url, true);
        if (asBase64) {
            xhr.responseType = 'arraybuffer';
        }
        xhr.onreadystatechange = function() {
            if ((xhr.readyState == 4) && (xhr.status == 200)) {
                if (asBase64) {
                    fnResponse(base64ArrayBuffer(xhr.response));
                } else {
                    fnResponse(xhr.response);
                }
            } else if(xhr.status != 200) {
                fnResponse('');
            }
        }
        xhr.send();
    },

    parseUrl: function(url) {
        var a = document.createElement('a');
        a.href = url;
        return {
            protocol: a.protocol,
            hostname: a.hostname,
            host: a.host,
            pathname: a.pathname,
            search: a.search,
            hash: a.hash
        }
    }
}
