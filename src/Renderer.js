if(constructor.name !== "Window"){
    onmessage = (e)=>{
        switch(e.data.type){
            case "evaluate":
                const r = new Renderer(e.data.id, e.data.content, e.data.templates);
                const html = r.evaluate();
                postMessage({
                    type:'evaluated',
                    time:r.time,
                    html:html
                });
                break;
        }
    };

    onerror = (e)=>{
        console.error(e);
    };
}

class Renderer
{
    constructor(pIdTemplate, pContent = {}, pTemplates = null)
    {
        Renderer.$ = pTemplates??Renderer.$;
        this.unescapeVars = true;
        this._content = pContent;
        this._c = {};
        this._functions = Renderer.FUNCTIONS||{};
        this._updateFunctionRE();
        this.time = null;
        this._id = pIdTemplate;
    }

    setFunction(pName, pFunction){
        this._functions[pName] = pFunction;
        this._updateFunctionRE();
    }

    _updateFunctionRE(){
        let fName = Object.getOwnPropertyNames(this._functions);
        this.RE_FUNCS = new RegExp(Renderer.TAG[0]+"("+fName.join("|")+")\\s([^"+Renderer.TAG[1]+"]+)"+Renderer.TAG[1], "gi");
    }

    evaluate()
    {
        this._c = Object.assign({}, this._content);
        let start = new Date().getTime();
        let t = Renderer.$[this._id];

        if(!t)
            return "";

        let t0 = Renderer.TAG[0];
        let t1 = Renderer.TAG[1];

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
            evaluation = evaluation.replaceAll(new RegExp(Renderer.VAR_ESC, 'g'), '{$');
        }
        let end = new Date().getTime();
        this.time = end - start;
        return evaluation;
    }

    _parseBlock(pString, pData)
    {
        let t_0 = Renderer.TAG[0];
        let t_1 = Renderer.TAG[1];

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

                    params = Renderer.parseParams(pOpener[3], {from:null, item:"item", key:"key"});
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

            let params = Renderer.parseParams(pFunc[2], {}, false);
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

        let allVars = [...pString.matchAll(Renderer.REGEXP_VAR)];
        allVars.forEach((pRes)=>{
            let val = this._parseVariables("$"+pRes[1], pData, rea);
            pString = pString.replace(pRes[0], val);
        });
        return pString;
    }

    _parseVariables(pString, pData, pREGEXP = Renderer.REGEXP_ID, pEscapeString = false)
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
                try{
                    value = value[method]();
                }catch(e){
                    console.warn('Template-worker.js : calling '+method+' triggered an error', e);
                    value = "";
                }
            }
            if((typeof value) === "string") {
                value = value.replaceAll(/\{\$/g, Renderer.VAR_ESC);
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
        let result = Renderer.REGEXP_ID.exec(pName);

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
}

Renderer.VAR_ESC = '<<@>>'
Renderer.TAG = ["{", "}"];
Renderer.REGEXP_FUNC = new RegExp("\\"+Renderer.TAG[0]+"\\=([^(]+)\\(([^"+Renderer.TAG[1]+"]+)\\)\\"+Renderer.TAG[1], "i");
Renderer.REGEXP_VAR = new RegExp("\\"+Renderer.TAG[0]+"\\$([a-z0-9\\._\\-\\(\\)]+)*\\"+Renderer.TAG[1], "gi");
Renderer.REGEXP_ID = new RegExp("([a-z0-9\.\_\-]+)", "i");

Renderer.$ = {};

Renderer.FUNCTIONS = {
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
        let t = new Renderer(id, vars);
        t.unescapeVars = false;
        return t.evaluate();
    }
};
