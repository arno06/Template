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
    constructor(pIdTemplate, pContent = {})
    {
        super();
        this.unescapeVars = true;
        this._content = pContent;
        this._c = {};
        this._functions = Template.FUNCTIONS||{};
        this._updateFunctionRE();
        this.time = null;
        this._id = pIdTemplate;
    }

    assign(pName, pValue)
    {
        this._content[pName] = pValue;
    }

    setFunction(pName, pFunction)
    {
        this._functions[pName] = pFunction;
        this._updateFunctionRE();
    }

    _updateFunctionRE(){
        let fName = Object.getOwnPropertyNames(this._functions);
        this.RE_FUNCS = new RegExp(Template.TAG[0]+"("+fName.join("|")+")\\s([^"+Template.TAG[1]+"]+)"+Template.TAG[1], "gi");
    }

    render(pParent)
    {
        let p = pParent;
        if((typeof p).toLowerCase()==="string")
            p = document.querySelector(pParent);
        if(!p)
            return;

        this.dispatchEvent(new Event(TemplateEvent.RENDER_INIT));

        p.innerHTML += this.evaluate();

        this.dispatchEvent(new Event(TemplateEvent.RENDER_COMPLETE));

        let images = p.querySelectorAll("img");

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

    evaluate()
    {
        this._c = Object.assign({}, this._content);
        let start = new Date().getTime();
        let t = Template.$[this._id];

        if(!t)
            return "";

        let t0 = Template.TAG[0];
        let t1 = Template.TAG[1];

        let re_blocs = new RegExp("(\\"+t0+"[a-z]+|\\"+t0+"\/[a-z]+)(\\s|\\"+t1+"){1}", "gi");

        let opener = [t0+"foreach", t0+"if"];
        let closer = [t0+"\/foreach", t0+"\/if"];
        let neutral= [t0+"else"];

        let step = 0;

        let currentId;

        let opened = [];

        let allBlocks = [...t.matchAll(re_blocs)];

        allBlocks.forEach((pBlock)=>{
            let tag = pBlock[1];
            if(opener.indexOf(tag)>-1)
            {
                currentId = ++step;
                opened.unshift(currentId);
            }
            else if (closer.indexOf(tag)>-1)
            {
                currentId = opened.shift();
            }
            else if (neutral.indexOf(tag)>-1)
            {
                currentId = opened[0];
            }
            else{
                return;
            }

            t = t.replace(pBlock[0], tag+"_"+currentId+pBlock[2]);
        });
        let evaluation = this._parseBlock(t, this._c);
        if(this.unescapeVars){
            evaluation = evaluation.replaceAll(new RegExp(Template.VAR_ESC, 'g'), '{$');
        }
        let end = new Date().getTime();
        this.time = end - start;
        return evaluation;
    }

    _parseBlock(pString, pData)
    {
        let t_0 = Template.TAG[0];
        let t_1 = Template.TAG[1];

        //{opener_X}
        let opener = new RegExp('\\'+t_0+'([a-z]+)(_[0-9]+)([^\}]*)\\'+t_1, 'gi');

        //$path.to.var
        let rea = /\$([a-z0-9\-_\\.]+)+(?=\.|>|<|!|\||=|\s|\)|%|,|$)/gi;

        let allBlocks = [...pString.matchAll(opener)];
        allBlocks.forEach((pOpener)=>{
            let params;
            let start = pString.indexOf(pOpener[0]);
            if(start===-1){
                //Block already replaced
                return;
            }
            let closer = new RegExp('\\'+t_0+'\/'+pOpener[1]+pOpener[2]+'\\'+t_1);
            let c = closer.exec(pString);

            if(!c)
            {
                console.log("no end tag");
                return;
            }

            let blc = pString.substring((start + pOpener[0].length), c.index);
            let alt = "";

            let neutral = new RegExp('\\'+t_0+'else'+pOpener[2]+'\\'+t_1, 'gi');

            let n = neutral.exec(pString);
            if(n)
            {
                blc = pString.substring(start+pOpener[0].length, n.index);
                alt = pString.substring(n.index+n[0].length, c.index);
            }

            let totalBlock = pString.substring(start, (c.index + c[0].length));

            let r = "";
            switch(pOpener[1])
            {
                case "foreach":

                    params = Template.parseParams(pOpener[3], {from:null, item:"item", key:"key"});
                    let d = this._getVariable(params.from, pData);
                    if(d)
                    {
                        let empty = true;
                        let c_key = params.key;
                        for(let j in d)
                        {
                            if(!d.hasOwnProperty(j))
                                continue;
                            empty = false;
                            let v = blc;
                            let dataCloned = Object.assign({}, pData);//Data cloning
                            dataCloned[params.item] = d[j];
                            dataCloned[c_key] = j;
                            v = this._parseBlock(v, dataCloned);
                            r += v;
                        }
                        if(empty === true)
                        {
                            r = this._parseBlock(alt, pData);
                        }
                    }
                    else
                        r = this._parseBlock(alt, pData);
                    break;
                case "if":
                    let f = this._parseVariables(pOpener[3], pData, rea, true);
                    while(f[0]===" ")
                        f = f.replace(/^\s/, '');
                    if(/^\s*$/.exec(f)||/^([!=><])/.exec(f)||/([\\|&])([!=><])/.exec(f))
                        f = false;
                    const c = '(_ => {let r=false;try{r = '+f+';}catch(e){r= false;} return r;})()';
                    let cond = eval(c);
                    r = cond?blc:(alt||"");
                    r = this._parseBlock(r, pData);
                    break;
                default:
                    return;
            }
            pString = pString.replace(totalBlock, r);
        });
        let allFunctions = [...pString.matchAll(this.RE_FUNCS)];
        allFunctions.forEach((pFunc)=>{
            let funcName = pFunc[1];
            let p = [];
            if(!this._functions[funcName])
            {
                throw new Error("Call to undefined function "+funcName);
            }

            let params = Template.parseParams(pFunc[2], {}, false);
            for(let k in params){
                if(!params.hasOwnProperty(k)){
                    continue;
                }

                if(params[k]){
                    if(params[k][0]==="$"){
                        params[k] = this._getVariable(params[k].replace("$", ""), pData);
                    }
                    else
                    {
                        if(/^[0-9][0-9\\.]*[0-9]*$/.exec(params[k]))
                            params[k] = Number(params[k]);
                        if(/^(["'])/.exec(params[k]))
                            params[k] = params[k].substring(1, params[k].length-1);
                    }
                }
            }

            let pa = /function\s*\(([^\\)]+)\)/.exec(this._functions[funcName].toString());

            if(pa){
                pa = pa[1].split(',').map((pName)=>pName.trim());
                pa.forEach((pName)=>{
                    p.push(params[pName]||null);
                });
            }
            p.push(params);
            pString = pString.replace(pFunc[0], this._functions[funcName].apply(this, p));
        });

        let allVars = [...pString.matchAll(Template.REGEXP_VAR)];
        allVars.forEach((pRes)=>{
            let val = this._parseVariables("$"+pRes[1], pData, rea);
            pString = pString.replace(pRes[0], val);
        });
        return pString;
    }

    _parseVariables(pString, pData, pREGEXP = Template.REGEXP_ID, pEscapeString = false)
    {
        let res;
        while(res = pREGEXP.exec(pString))
        {
            let value = this._getVariable(res[1], pData);
            if(pEscapeString){
                if((typeof value ) === "string"){
                    value = "'"+value.replace(/'/g, "\\'")+"'";
                }else{
                    value = JSON.stringify(value);
                }
            }
            if(pString.indexOf("()")>-1){
                let method = pString.replace("$"+res[1]+".", "").replace("()", "");
                res[0] = "$"+res[1]+"."+method+"()";
                value = value[method]();
            }
            if((typeof value) === "string") {
                value = value.replaceAll(/\{\$/g, Template.VAR_ESC);
            }
            pString = pString.replace(res[0], value);
        }
        return pString;
    }

    static parseParams(pString, pDefaults, pEscape = true){
        pString = pString.split(" ");
        let params = {...pDefaults};
        let index = 0;
        pString.filter((pVal)=>pVal.length).forEach((pParam)=>{
            let [name, val] = pParam.split('=');
            if(!val){
                val = name;
                name = "param"+(index++);
            }
            params[name] = pEscape?val.replace(/(["'\\$])/g, ''):val;
        });
        return params;
    }

    _getVariable(pName, pContext)
    {
        let default_value = "";
        let data = pContext||this._c;
        let result = Template.REGEXP_ID.exec(pName);

        if(!result)
            return default_value;

        let levels = result[1].split(".");

        for(let i = 0, max = levels.length;i<max;i++)
        {
            if (typeof data[levels[i]] == "undefined")
            {
                return default_value;
            }
            data = data[levels[i]];
        }

        return data;
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

Template.VAR_ESC = '<<@>>'
Template.TAG = ["{", "}"];
Template.REGEXP_FUNC = new RegExp("\\"+Template.TAG[0]+"\\=([^(]+)\\(([^"+Template.TAG[1]+"]+)\\)\\"+Template.TAG[1], "i");
Template.REGEXP_VAR = new RegExp("\\"+Template.TAG[0]+"\\$([a-z0-9\\._\\-\\(\\)]+)*\\"+Template.TAG[1], "gi");
Template.REGEXP_ID = new RegExp("([a-z0-9\.\_\-]+)", "i");
Template.SCRIPT_TYPE = 'text/template';

Template.$ = {};

Template.FUNCTIONS = {
    truncate:function(string, length, end) {
        length = length||80;
        end = end||"...";
        if(string.length<=length)
            return string;
        string = string.substring(0, length);
        return string+end;
    },
    uppercase:function(string)
    {
        return string.toUpperCase();
    },
    lowercase:function(string)
    {
        return string.toLowerCase();
    },
    replace:function(string, search, replace, flags)
    {
        flags = flags||"gi";
        let re = new RegExp(search, flags);
        return string.replace(re, replace);
    },
    add:function()
    {
        let values = arguments[0];
        let result = 0;
        for(let i in values){
            result += Number(values[i]);
        }
        return result;
    },
    include:function(id)
    {
        let vars = Object.assign(this._c, arguments[arguments.length-1]);
        let t = new Template(id, vars);
        t.unescapeVars = false;
        return t.evaluate();
    }
};

window.addEventListener("DOMContentLoaded", Template.setup, false);
