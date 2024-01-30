"use strict";
/**
 * @author Arnaud NICOLAS <arno06@gmail.com>
 * @repo https://github.com/arno06/Template
 */
class EventEmitter
{
    constructor()
    {
        this.delegate = document.createDocumentFragment();
    }

    addEventListener(...args){
        this.delegate.addEventListener(...args);
    }

    dispatchEvent(event){
        this.delegate.dispatchEvent(event);
    }

    removeEventListener(...args){
        this.delegate.removeEventListener(...args);
    }
}

class Template extends EventEmitter
{
    constructor(pIdTemplate, pContent = {}, pWorkerPath = null)
    {
        super();
        this.unescapeVars = true;
        this._content = pContent;
        this._c = {};
        this.time = null;
        this._id = pIdTemplate;
        this._functions = {};
        this.mode = 'main';
        if(!Renderer){
            this.mode = 'worker';
            if(!pWorkerPath){
                let url = new URL(document.querySelector('script[src*="Template.js"]').getAttribute("src"), window.location);
                this._rendererPath = url.searchParams.get('worker')??'Renderer.js';
            }else{
                this._rendererPath = pWorkerPath;
            }
        }
    }

    assign(pName, pValue)
    {
        this._content[pName] = pValue;
    }

    setFunction(pName, pFunction)
    {
        if(!Renderer){
            return;
        }
        this._functions[pName] = pFunction;
    }

    render(pParent)
    {
        let p = pParent;
        if((typeof p).toLowerCase()==="string")
            p = document.querySelector(pParent);
        if(!p)
            return;

        this.dispatchEvent(new Event(TemplateEvent.RENDER_INIT));

        if(this.mode === 'worker'){
            let worker = new Worker(this._rendererPath);
            worker.onmessage = (e)=>{
                switch(e.data.type){
                    case RendererEvent.EVENT_EVALUATED:
                        this.evaluated(p, e.data.time, e.data.html);
                        worker.terminate();
                        break
                }
            };
            worker.postMessage({type:RendererEvent.EVENT_EVALUATE, content:this._content, templates:Template.$, id:this._id});
        }else{
            let renderer = new Renderer(this._id, this._content, Template.$);
            for(let i in this._functions){
                if(!this._functions.hasOwnProperty(i)){
                    continue;
                }
                renderer.setFunction(i, this._functions[i]);
            }
            const html = renderer.evaluate();
            this.evaluated(p, renderer.time, html);
        }
    }

    evaluated(pTarget, pTime, pHtml){
        pTarget.innerHTML += pHtml;

        this.time = pTime;

        this.dispatchEvent(new Event(TemplateEvent.RENDER_COMPLETE));

        let images = pTarget.querySelectorAll("img");

        let max = images.length;

        if(!max)
        {
            this.dispatchEvent(new Event(TemplateEvent.RENDER_COMPLETE_LOADED));
            return;
        }

        let i = 0;

        let tick = _ => {

            if(++i===max)
                this.dispatchEvent(new Event(TemplateEvent.RENDER_COMPLETE_LOADED));
        };

        images.forEach(img =>
        {
            if(img.complete && (++i===max))
            {
                this.dispatchEvent(new Event(TemplateEvent.RENDER_COMPLETE_LOADED));
            }
            img.onload = tick;
            img.onerror = tick;
        });
    }

    static load(pDataList)
    {
        if(!Request||!Request.onComplete){
            console.warn("Missing Request Lib");
            return;
        }
        let _data = [];
        for(let i in pDataList)
        {
            if(!pDataList.hasOwnProperty(i))
                continue;
            _data.push({"name":i, "file":pDataList[i]});
        }

        let _currentIndex = -1;
        let _callBack = null;

        function templateLoadedHandler(pReq)
        {
            Template.$[_data[_currentIndex].name] = pReq.responseText;
            next();
        }

        function next()
        {
            _currentIndex++;
            if(_currentIndex>=_data.length)
            {
                if(_callBack)
                    _callBack();
                return;
            }

            Request.load(_data[_currentIndex].file).onComplete(templateLoadedHandler).onError(next);
        }

        next();

        return {
            onComplete:function(pCallBack)
            {
                _callBack = pCallBack;
                return this;
            }
        };
    }

    static setup()
    {
        let templates = document.querySelectorAll('script[type="'+Template.SCRIPT_TYPE+'"]');
        templates.forEach(function(pEl)
        {
            Template.$[pEl.getAttribute("id")] = pEl.text;
            pEl.parentNode.removeChild(pEl);
        });
    }
}
const TemplateEvent = {};
TemplateEvent.RENDER_INIT = "evt_render_start";
TemplateEvent.RENDER_COMPLETE = "evt_render_complete";
TemplateEvent.RENDER_COMPLETE_LOADED = "evt_render_loaded_complete";

const RendererEvent = {
    EVENT_EVALUATE: 'evaluate',
    EVENT_EVALUATED: 'evaluated',
};

Template.REGEXP_ID = new RegExp("([a-z0-9\.\_\-]+)", "i");
Template.SCRIPT_TYPE = 'text/template';

Template.$ = {};

window.addEventListener("DOMContentLoaded", Template.setup, false);
