import{c as M}from"./@vendor-core-BNBX1K9v.js";var W={exports:{}},_={};/**
 * @license React
 * use-sync-external-store-with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var $;function g(){if($)return _;$=1;var n=M();function h(c,o){return c===o&&(c!==0||1/c===1/o)||c!==c&&o!==o}var E=typeof Object.is=="function"?Object.is:h,y=n.useSyncExternalStore,p=n.useRef,R=n.useEffect,b=n.useMemo,w=n.useDebugValue;return _.useSyncExternalStoreWithSelector=function(c,o,f,e,r){var u=p(null);if(u.current===null){var i={hasValue:!1,value:null};u.current=i}else i=u.current;u=b(function(){function s(l){if(!V){if(V=!0,S=l,l=e(l),r!==void 0&&i.hasValue){var a=i.value;if(r(a,l))return v=a}return v=l}if(a=v,E(S,l))return a;var d=e(l);return r!==void 0&&r(a,d)?(S=l,a):(S=l,v=d)}var V=!1,S,v,m=f===void 0?null:f;return[function(){return s(o())},m===null?void 0:function(){return s(m())}]},[o,f,e,r]);var t=y(c,u[0],u[1]);return R(function(){i.hasValue=!0,i.value=t},[t]),w(t),t},_}var q;function k(){return q||(q=1,W.exports=g()),W.exports}var J=k(),j={exports:{}},x={},z={exports:{}},D={};/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var U;function C(){if(U)return D;U=1;var n=M();function h(e,r){return e===r&&(e!==0||1/e===1/r)||e!==e&&r!==r}var E=typeof Object.is=="function"?Object.is:h,y=n.useState,p=n.useEffect,R=n.useLayoutEffect,b=n.useDebugValue;function w(e,r){var u=r(),i=y({inst:{value:u,getSnapshot:r}}),t=i[0].inst,s=i[1];return R(function(){t.value=u,t.getSnapshot=r,c(t)&&s({inst:t})},[e,u,r]),p(function(){return c(t)&&s({inst:t}),e(function(){c(t)&&s({inst:t})})},[e]),b(u),u}function c(e){var r=e.getSnapshot;e=e.value;try{var u=r();return!E(e,u)}catch{return!0}}function o(e,r){return r()}var f=typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"?o:w;return D.useSyncExternalStore=n.useSyncExternalStore!==void 0?n.useSyncExternalStore:f,D}var I;function A(){return I||(I=1,z.exports=C()),z.exports}/**
 * @license React
 * use-sync-external-store-shim/with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var G;function B(){if(G)return x;G=1;var n=M(),h=A();function E(o,f){return o===f&&(o!==0||1/o===1/f)||o!==o&&f!==f}var y=typeof Object.is=="function"?Object.is:E,p=h.useSyncExternalStore,R=n.useRef,b=n.useEffect,w=n.useMemo,c=n.useDebugValue;return x.useSyncExternalStoreWithSelector=function(o,f,e,r,u){var i=R(null);if(i.current===null){var t={hasValue:!1,value:null};i.current=t}else t=i.current;i=w(function(){function V(a){if(!S){if(S=!0,v=a,a=r(a),u!==void 0&&t.hasValue){var d=t.value;if(u(d,a))return m=d}return m=a}if(d=m,y(v,a))return d;var O=r(a);return u!==void 0&&u(d,O)?(v=a,d):(v=a,m=O)}var S=!1,v,m,l=e===void 0?null:e;return[function(){return V(f())},l===null?void 0:function(){return V(l())}]},[f,e,r,u]);var s=p(o,i[0],i[1]);return b(function(){t.hasValue=!0,t.value=s},[s]),c(s),s},x}var L;function F(){return L||(L=1,j.exports=B()),j.exports}var K=F();export{K as a,J as w};
