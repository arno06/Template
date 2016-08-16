"use strict";

var Puppy = (function(){
    var sources = {};
    var events = {
        UPDATED_DATA: 'evt_updated_data'
    };

    class Container extends EventEmitter
    {
        constructor(pElement, pDataSource, pTemplate)
        {
            this.element = pElement;
            this.source = pDataSource;
            this.template = pTemplate;
            this.template.addEventListener(TemplateEvent.RENDER_COMPLETE, this.dispatchEvent.bind(this));
            this.source.addEventListener(events.UPDATED_DATA, this._dataUpdated.bind(this), false);
            this._dataUpdated();
        }

        _dataUpdated()
        {
            this.template._content = this.source.getData();
            this.element.innerHTML = '';
            this.template.render(this.element);
        }
    }

    class DataSource extends EventEmitter
    {
        constructor(pData = null)
        {
            if(pData !== null)
                this.data = pData;
        }

        setValue(pName, pData)
        {
            this._data[pName] = pData;
            this.dispatchEvent(new Event(events.UPDATED_DATA));
        }

        set data(pValue)
        {
            this._data = pValue;
            this.dispatchEvent(new Event(events.UPDATED_DATA));
        }

        get data()
        {
            return this._data;
        }
    }

    if(!NodeList.prototype.forEach)
        NodeList.prototype.forEach = Array.prototype.forEach;


    function defineContainer(pElement)
    {
        if(!pElement.getAttribute('data-source') || !pElement.getAttribute('data-template'))
            return false;
        let src = pElement.getAttribute('data-source');
        let tpl = pElement.getAttribute('data-template');
        if(!sources[src])
            return false;
        return new Container(pElement, sources[src], new Template(tpl));
    }

    function defineSource(pName, pData)
    {
        pName = 'Puppy.'+pName;
        sources[pName] = new DataSource(pData);
        return sources[pName];
    }

    return {
        define: {
            container:defineContainer,
            source:defineSource
        }
    }
})();