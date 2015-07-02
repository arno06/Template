var Puppy = (function(){
    var sources = {};
    var events = {
        UPDATED_DATA: 'evt_updated_data'
    };

    function Container(pElement, pDataSource, pTemplate)
    {
        this.element = pElement;
        this.source = pDataSource;
        this.template = pTemplate;
        this.template.addEventListener(TemplateEvent.RENDER_COMPLETE, this.dispatchEvent.proxy(this));
        this.source.addEventListener(events.UPDATED_DATA, this._dataUpdated.proxy(this), false);
        this._dataUpdated();
    }

    Class.define(Container, [EventDispatcher], {
        _dataUpdated:function()
        {
            this.template._content = this.source.getData();
            this.element.innerHTML = '';
            this.template.render(this.element);
        }
    });


    function DataSource(pData)
    {
        this._data = pData;
        this.dispatchEvent(new Event(events.UPDATED_DATA));
    }

    Class.define(DataSource, [EventDispatcher], {
        setData:function(pData)
        {
            this._data = pData;
            this.dispatchEvent(new Event(events.UPDATED_DATA));
        },
        setValue:function(pName, pData)
        {
            this._data[pName] = pData;
            this.dispatchEvent(new Event(events.UPDATED_DATA));
        },
        getData:function()
        {
            return this._data;
        }
    });

    if(!NodeList.prototype.forEach)
        NodeList.prototype.forEach = Array.prototype.forEach;


    function defineContainer(pElement)
    {
        if(!pElement.getAttribute('data-source') || !pElement.getAttribute('data-template'))
            return false;
        var src = pElement.getAttribute('data-source');
        var tpl = pElement.getAttribute('data-template');
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