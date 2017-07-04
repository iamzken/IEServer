/*
 * storage.js
 *
 * Storage support (sorry, pedantic, maybe more later)
 *
*/
if (typeof(IETAB) == "undefined")
    IETAB = {};

IETAB.Storage = {
    get: function(key) {
        var value = localStorage[key];
        if(typeof(value) == "undefined")
            return null;

        try {
            return JSON.parse(value);
        } catch(ex) {
            // If it's not valid JSON (e.g. manually edited), just return null
            console.log('Invalid storage value: ' + key);
            return null;
        }
    },

    set: function(key, value) {
        if (!value && (typeof(value) != 'boolean'))
            delete localStorage[key];
        else
            localStorage[key] = JSON.stringify(value);

        if ( (key == 'ECMSettings') || (key == 'ECMTestSettings') ) {
            if (Background) {
                Background.onAutoUrlsChanged();
            }
        }
    }
}
