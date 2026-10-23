import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';
import { SketchPicker } from 'react-color';
import { Save, Upload, Palette, Layout, Eye, Check } from 'lucide-react';

const RenderMockup = ({ config, activeEmisor, logoPreview }) => {
    const layout = config.layout_id || 'v1';

    // Datos comunes para todos los layouts
    const commonData = {
        razonSocial: activeEmisor.razon_social,
        rfc: activeEmisor.rfc,
        cp: activeEmisor.codigo_postal,
        font: config.tipo_letra,
        primary: config.color_primario,
        secondary: config.color_secundario,
        logo: logoPreview
    };

    const config_adicional = config.config_adicional || {
        visible_sections: { header: true, info: true, concepts: true, totals: true, stamps: true, footer: true },
        spacing: { page_padding: 60, section_gap: 40, font_size: 10 },
        sections_order: ['header', 'info', 'concepts', 'totals', 'stamps', 'footer']
    };

    const ConceptosTable = ({ headerStyle }) => (
        <table className="w-full mb-8 border-collapse">
            <thead>
                <tr className="text-white text-[10px] uppercase font-bold" style={headerStyle}>
                    <th className="p-2 text-left w-12 rounded-tl">CANT</th>
                    <th className="p-2 text-left w-20">UNIDAD</th>
                    <th className="p-2 text-left w-24">CLAVE SAT</th>
                    <th className="p-2 text-left">DESCRIPCIÓN</th>
                    <th className="p-2 text-right">PRECIO</th>
                    <th className="p-2 text-right rounded-tr">IMPORTE</th>
                </tr>
            </thead>
            <tbody className="text-[11px]">
                <tr className="border-b border-slate-100">
                    <td className="p-3 text-slate-600">1.00</td>
                    <td className="p-3 text-slate-500 uppercase">H87 - PZA</td>
                    <td className="p-3 text-slate-500 font-mono">43201830</td>
                    <td className="p-3 font-bold">UNIDAD DE ESTADO SOLIDO QUARONI / 256GB</td>
                    <td className="p-3 text-right">$1,000.000000</td>
                    <td className="p-3 text-right font-bold">$1,000.000000</td>
                </tr>
            </tbody>
        </table>
    );

    const TotalesBox = () => (
        <div className="flex justify-end mb-12">
            <div className="w-56 space-y-2 text-[11px]">
                <div className="flex justify-between border-b border-slate-50 pb-1">
                    <span className="text-slate-500 uppercase font-semibold text-[9px]">SUBTOTAL:</span>
                    <span className="font-bold">$6,000.00</span>
                </div>
                <div
                    className="flex justify-between p-3 rounded shadow-sm text-white font-black text-lg items-center"
                    style={{ backgroundColor: commonData.primary }}
                >
                    <span className="text-xs opacity-80 font-normal">TOTAL:</span>
                    <span>$6,960.00</span>
                </div>
            </div>
        </div>
    );

    const FiscalStamps = () => (
        <div className="flex gap-6 border-t border-slate-100 pt-8 opacity-60">
            <div className="w-24 h-24 bg-slate-200 rounded flex items-center justify-center">
                <div className="w-16 h-16 border-2 border-slate-300 opacity-30"></div>
            </div>
            <div className="flex-1 space-y-3 font-mono text-[8px] overflow-hidden">
                <div>
                    <span className="font-bold block mb-1 uppercase">Folio Fiscal (UUID)</span>
                    <span className="text-slate-400 select-all">8FA485C1-766C-4C35-8EF6-4127A76B4D08</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded"></div>
            </div>
        </div>
    );

    const renderLayout = () => {
        const spacingStyle = { gap: `${config_adicional.spacing.section_gap}px` };
        
        const sections = {
            header: config_adicional.visible_sections.header && (
                <div key="header">
                    {(() => {
                        switch (layout) {
                            case 'v2':
                                return (
                                    <div className="flex justify-between items-start mb-12">
                                        <div className="w-1/3">
                                            {commonData.logo ? (
                                                <img src={commonData.logo} className="max-h-20 object-contain mb-4" />
                                            ) : (
                                                <div className="w-20 h-20 bg-slate-100 flex items-center justify-center rounded text-[10px] text-slate-400 font-bold">LOGO</div>
                                            )}
                                        </div>
                                        <div className="w-2/3 text-right">
                                            <h1 className="text-3xl font-black uppercase tracking-tighter" style={{ color: commonData.primary }}>{commonData.razonSocial}</h1>
                                            <p className="text-[10px] font-bold text-slate-400 mt-2">RFC: {commonData.rfc}</p>
                                        </div>
                                    </div>
                                );
                            case 'v3':
                                return (
                                    <div className="flex flex-col items-center mb-12 border-b border-slate-50 pb-12 text-center">
                                        <div className="w-24 h-24 mb-6 p-2 border border-slate-100 rounded-full flex items-center justify-center">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-full object-contain" /> : <span className="text-[10px] text-slate-300">LOGO</span>}
                                        </div>
                                        <h1 className="text-2xl font-light tracking-[0.4em] uppercase" style={{ color: commonData.primary }}>{commonData.razonSocial}</h1>
                                    </div>
                                );
                            case 'v4':
                                return (
                                    <div className="flex justify-between items-start mb-16 border-b border-slate-100 pb-16">
                                        <div className="max-w-xs">
                                            <h1 className="text-2xl font-bold mb-3 tracking-tighter">{commonData.razonSocial}</h1>
                                            <p className="text-slate-400 font-medium tracking-wide">{commonData.rfc}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-300 mb-2 tracking-[0.3em]">FACTURA</p>
                                            <p className="text-4xl font-light tracking-tighter" style={{ color: commonData.primary }}>#A-450</p>
                                        </div>
                                    </div>
                                );
                            case 'v5':
                                return (
                                    <div className="p-8 rounded-2xl flex justify-between items-center mb-10 text-white" style={{ backgroundColor: commonData.primary }}>
                                        <div>
                                            <h1 className="text-2xl font-black">{commonData.razonSocial}</h1>
                                            <p className="text-xs opacity-80">RFC: {commonData.rfc}</p>
                                        </div>
                                        <div className="w-24 h-12 bg-white rounded-lg flex items-center justify-center p-2">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-full" /> : <span className="text-[8px] text-slate-300 font-black">CORP</span>}
                                        </div>
                                    </div>
                                );
                            case 'v6':
                                return (
                                    <div className="p-12 mb-10 flex justify-between items-center" style={{ background: `linear-gradient(135deg, ${commonData.primary} 0%, ${commonData.secondary} 100%)` }}>
                                        <div className="text-white">
                                            <h1 className="text-3xl font-black italic tracking-tighter">{commonData.razonSocial}</h1>
                                            <p className="text-xs opacity-70">RFC: {commonData.rfc}</p>
                                        </div>
                                        <div className="p-4 bg-white/10 backdrop-blur rounded-xl border border-white/20">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-12 brightness-0 invert" /> : <Layout className="w-8 h-8 text-white" />}
                                        </div>
                                    </div>
                                );
                            case 'v7':
                                return (
                                    <div className="text-center mb-10">
                                        <h1 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Factura Electrónica</h1>
                                        <div className="flex justify-between items-stretch gap-6">
                                            <div className="flex-1 bg-primary-600 p-8 rounded-lg text-white text-left" style={{ backgroundColor: commonData.primary }}>
                                                <h1 className="text-2xl font-black mb-2">{commonData.razonSocial}</h1>
                                                <p className="text-xs opacity-80">RFC: {commonData.rfc}</p>
                                            </div>
                                            <div className="w-48 border rounded-lg flex items-center justify-center p-4">
                                                {commonData.logo ? <img src={commonData.logo} className="max-h-full" /> : <div className="text-xl font-black text-slate-100">LOGO</div>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'v8':
                                return (
                                    <div className="flex justify-between items-start mb-10 text-left">
                                        <div className="flex-1">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-16 mb-4" /> : <div className="text-2xl font-black text-slate-200 mb-4 uppercase">Logo</div>}
                                            <h1 className="text-xl font-black uppercase text-slate-800">{commonData.razonSocial}</h1>
                                            <p className="text-[10px] text-slate-500 font-bold">RFC: {commonData.rfc}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Factura No.</span>
                                            <p className="text-2xl font-black text-red-600">A-1500</p>
                                        </div>
                                    </div>
                                );
                            case 'v9':
                                return (
                                    <div className="flex justify-between items-center mb-10 p-10 text-white rounded-t-3xl" style={{ backgroundColor: commonData.primary }}>
                                        <div className="text-left">
                                            <h1 className="text-3xl font-black tracking-tighter uppercase">{commonData.razonSocial}</h1>
                                            <p className="text-xs opacity-70 font-bold">RFC: {commonData.rfc}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl shadow-2xl text-primary-600 text-right" style={{ color: commonData.primary }}>
                                            <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Comprobante</span>
                                            <p className="text-2xl font-black">A-1500</p>
                                        </div>
                                    </div>
                                );
                            case 'v10':
                                return (
                                    <div className="flex border border-slate-200 mb-10 overflow-hidden rounded-xl text-left">
                                        <div className="w-48 p-6 border-r border-slate-200 bg-slate-50/50 flex items-center justify-center">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-16" /> : <span className="text-xl font-black text-slate-200">LOGO</span>}
                                        </div>
                                        <div className="flex-1 p-6">
                                            <h1 className="text-lg font-black text-slate-800 uppercase mb-2">{commonData.razonSocial}</h1>
                                            <p className="text-[11px] font-bold text-slate-500 italic">RFC: {commonData.rfc}</p>
                                        </div>
                                        <div className="w-40 p-6 bg-slate-50/50 border-l border-slate-200 text-center flex flex-col justify-center">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Factura</span>
                                            <p className="text-xl font-black text-primary-600" style={{ color: commonData.primary }}>A-1500</p>
                                        </div>
                                    </div>
                                );
                            case 'v11':
                                return (
                                    <div className="border-b-4 mb-10 pb-8 text-left" style={{ borderColor: commonData.primary }}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-6">
                                                <div className="w-24 h-24 bg-slate-50 border border-slate-100 flex items-center justify-center p-2 rounded">
                                                    {commonData.logo ? <img src={commonData.logo} className="max-h-full" /> : <div className="text-xs font-black text-slate-200">LOGO</div>}
                                                </div>
                                                <div className="pt-2">
                                                    <h1 className="text-xl font-black text-slate-900 uppercase">{commonData.razonSocial}</h1>
                                                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase">RFC: {commonData.rfc}</p>
                                                </div>
                                            </div>
                                            <div className="text-right border-l pl-8 border-slate-100">
                                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Comprobante</h2>
                                                <p className="text-3xl font-black" style={{ color: commonData.primary }}>A-1500</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'v12':
                                return (
                                    <div className="flex justify-between items-start mb-16">
                                        <div className="text-left">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-20" /> : <span className="text-4xl font-thin tracking-[0.4em] text-slate-200 uppercase">Premium</span>}
                                        </div>
                                        <div className="text-right border-r-4 pr-6" style={{ borderColor: commonData.primary }}>
                                            <h1 className="text-4xl font-thin tracking-[0.2em] text-primary-500 uppercase" style={{ color: commonData.primary }}>Factura</h1>
                                            <p className="text-xl font-black text-slate-600 mt-2">ID-129034</p>
                                        </div>
                                    </div>
                                );
                            default:
                                return (
                                    <div className="flex justify-between items-start mb-10">
                                        <div className="p-8 rounded-3xl text-white flex-1 mr-10 shadow-xl" style={{ backgroundColor: commonData.primary }}>
                                            <h1 className="text-3xl font-black mb-1 leading-none tracking-tight">{commonData.razonSocial}</h1>
                                            <p className="text-sm opacity-90 font-bold tracking-wide">{commonData.rfc}</p>
                                        </div>
                                        <div className="w-32 h-32 flex items-center justify-center border-2 border-slate-50 rounded-[2rem] bg-slate-50/50 shadow-inner p-4">
                                            {commonData.logo ? <img src={commonData.logo} className="max-h-full object-contain" /> : <Layout className="w-8 h-8 text-slate-200" />}
                                        </div>
                                    </div>
                                );
                        }
                    })()}
                </div>
            ),
            info: config_adicional.visible_sections.info && (
                <div key="info" className="mb-12">
                    {(() => {
                        switch (layout) {
                            case 'v3':
                                return (
                                    <div className="grid grid-cols-2 gap-12 text-left italic border-y border-slate-50 py-8">
                                        <div>
                                            <span className="text-[8px] uppercase tracking-widest text-slate-300 block mb-2 font-black border-l-2 pl-3" style={{ borderColor: commonData.primary }}>Consignado a</span>
                                            <p className="font-bold text-slate-800 text-sm">CLIENTE DISTINGUIDO</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] uppercase tracking-widest text-slate-300 block mb-2 font-black">Detalles</span>
                                            <p className="text-xs">Folio: <span className="font-bold" style={{ color: commonData.primary }}>000100</span></p>
                                        </div>
                                    </div>
                                );
                            case 'v4':
                                return (
                                    <div className="mb-16 text-left">
                                        <h4 className="text-[8px] font-black text-slate-200 uppercase mb-3 tracking-widest">Facturado a</h4>
                                        <p className="text-lg font-bold uppercase">ABARROTES EL CENTRO</p>
                                    </div>
                                );
                            case 'v5':
                                return (
                                    <div className="grid grid-cols-2 gap-8 mb-10 text-left">
                                        <div className="border rounded-xl p-6 bg-slate-50/30">
                                            <span className="text-[9px] font-black text-primary-600 uppercase block mb-3" style={{ color: commonData.primary }}>Datos del Cliente</span>
                                            <p className="font-black text-slate-800 text-lg">PÚBLICO EN GENERAL</p>
                                            <p className="text-xs text-slate-500">RFC: XAXX010101000</p>
                                        </div>
                                        <div className="border rounded-xl p-6 bg-slate-50/30">
                                            <span className="text-[9px] font-black text-primary-600 uppercase block mb-3" style={{ color: commonData.primary }}>Comprobante</span>
                                            <p className="text-sm"><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
                                            <p className="text-sm"><strong>Folio:</strong> A-1200</p>
                                        </div>
                                    </div>
                                );
                            case 'v6':
                                return (
                                    <div className="grid grid-cols-3 gap-8 mb-10 text-left text-white/80">
                                        <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                                            <span className="text-[8px] font-black text-primary-400 uppercase tracking-[0.2em] block mb-3" style={{ color: commonData.primary }}>// RECEPTOR</span>
                                            <p className="text-xl font-black text-white uppercase">CLIENTE TECNOLÓGICO S.A.</p>
                                            <p className="text-xs opacity-60 mt-2">RFC: CTE010101ABC</p>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-right flex flex-col justify-center">
                                            <span className="text-[8px] font-black text-primary-400 uppercase tracking-[0.2em] mb-1" style={{ color: commonData.primary }}>// COM_ID</span>
                                            <p className="text-2xl font-black text-white">#9834</p>
                                        </div>
                                    </div>
                                );
                            case 'v7':
                                return (
                                    <div className="space-y-6 text-left mb-10">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 border border-slate-100 rounded bg-slate-50/30">
                                                <span className="text-[7px] font-black text-slate-400 uppercase">Certificación</span>
                                                <p className="text-[10px] font-bold">{new Date().toLocaleString()}</p>
                                            </div>
                                            <div className="p-4 border border-slate-100 rounded bg-slate-50/30">
                                                <span className="text-[7px] font-black text-slate-400 uppercase">Uso CFDI</span>
                                                <p className="text-[10px] font-bold">G03 - Gastos en general</p>
                                            </div>
                                        </div>
                                        <div className="border border-slate-100 rounded bg-white">
                                            <div className="bg-slate-50 p-2 text-[8px] font-black text-slate-500 uppercase border-b">Receptor del Comprobante</div>
                                            <div className="p-4">
                                                <p className="text-base font-black text-slate-800 uppercase">PÚBLICO EN GENERAL</p>
                                                <p className="text-[10px] text-primary-600 font-black mt-1" style={{ color: commonData.primary }}>RFC: XAXX010101000</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'v9':
                                return (
                                    <div className="space-y-8 mb-10 text-left">
                                        <div className="bg-slate-50 p-6 border rounded-2xl flex justify-between items-center">
                                            {['Fecha', 'CP', 'Uso'].map(l => (
                                                <div key={l}>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">{l}</span>
                                                    <span className="text-[10px] font-bold text-slate-700">{l === 'Fecha' ? new Date().toLocaleDateString() : '29000'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-10">
                                            <div>
                                                <h3 className="text-[9px] font-black text-primary-600 uppercase mb-4 border-b-2 pb-2" style={{ borderColor: commonData.primary }}>Datos del Receptor</h3>
                                                <p className="text-lg font-black text-slate-800 uppercase leading-none mb-2">NOMBRE DEL CLIENTE</p>
                                                <p className="text-xs font-bold text-slate-400">RFC: XXX000000000</p>
                                            </div>
                                            <div>
                                                <h3 className="text-[9px] font-black text-primary-600 uppercase mb-4 border-b-2 pb-2" style={{ borderColor: commonData.primary }}>Datos Fiscales</h3>
                                                <p className="text-[10px] font-bold text-slate-500 max-w-xs break-all leading-relaxed">UUID: 8FA485C1-766C-4C35-8EF6-4127A76B4D08</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'v10':
                                return (
                                    <div className="space-y-6 mb-10 text-left">
                                        <div className="grid grid-cols-3 border-t border-l border-slate-200">
                                            {['Versión 4.0', '15/03/2026', 'ID-84738'].map(v => (
                                                <div key={v} className="p-3 border-r border-b border-slate-200">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Dato</span>
                                                    <span className="text-[10px] font-black text-slate-700">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-slate-100 p-6 rounded-lg flex justify-between items-center">
                                            <div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Facturado a:</span>
                                                <p className="text-base font-black text-slate-800 uppercase">PÚBLICO EN GENERAL</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black text-slate-500">RFC: XAXX010101000</p>
                                                <p className="text-[10px] text-slate-400">CP: 29010</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'v11':
                                return (
                                    <div className="space-y-6 mb-10 text-left">
                                        <h3 className="bg-slate-900 text-white px-4 py-1.5 text-[9px] font-black uppercase tracking-wider">Identificación del Receptor</h3>
                                        <div className="border-2 border-slate-900 grid grid-cols-2">
                                            <div className="p-6 border-r border-slate-200">
                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-2">Cliente / Razón Social</p>
                                                <p className="text-sm font-black text-slate-900 uppercase">NOMBRE DEL CLIENTE EJECUTIVO</p>
                                                <p className="text-xs font-bold text-slate-500 mt-4 uppercase">RFC: XXX010101AAA</p>
                                            </div>
                                            <div className="p-6 space-y-4">
                                                <p className="text-[7px] font-black text-slate-400 uppercase">Detalles CFDI</p>
                                                <p className="text-xs font-bold text-slate-700 uppercase">Uso: G03 - Gastos en general</p>
                                                <p className="text-xs font-bold text-slate-700 uppercase">CP-EXP: 29000</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            default:
                                return (
                                    <div className="grid grid-cols-2 gap-12 mb-12">
                                        <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 text-left">
                                            <span className="text-[9px] font-black text-slate-300 uppercase block mb-3 tracking-widest">Receptor del CFDI</span>
                                            <p className="font-black text-slate-800 text-base mb-1 uppercase">PÚBLICO EN GENERAL</p>
                                            <p className="text-slate-400 font-bold">RFC: XAXX010101000</p>
                                        </div>
                                        <div className="text-right flex flex-col justify-center">
                                            <p className="text-slate-400 font-black text-[10px] tracking-widest mb-1 uppercase">Folio Fiscal</p>
                                            <p className="text-3xl font-black" style={{ color: commonData.primary }}>A-1500</p>
                                            <div className="mt-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider">Fecha: {new Date().toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                );
                        }
                    })()}
                </div>
            ),
            concepts: config_adicional.visible_sections.concepts && (
                <div key="concepts" className="mb-8">
                    {(() => {
                        let headerStyle = { backgroundColor: commonData.primary };
                        if (layout === 'v4' || layout === 'v8' || layout === 'v11') headerStyle = { backgroundColor: '#111' };
                        if (layout === 'v6') headerStyle = { background: `linear-gradient(90deg, ${commonData.primary}, ${commonData.secondary})` };
                        if (layout === 'v12' || layout === 'v10' || layout === 'v9') headerStyle = { backgroundColor: '#f8fafc', color: '#64748b' };
                        if (layout === 'v7') headerStyle = { backgroundColor: commonData.primary };
                        return <ConceptosTable headerStyle={headerStyle} />;
                    })()}
                </div>
            ),
            totals: config_adicional.visible_sections.totals && <TotalesBox key="totals" />,
            stamps: config_adicional.visible_sections.stamps && <FiscalStamps key="stamps" />,
            footer: config_adicional.visible_sections.footer && (
                <div key="footer" className="mt-12 pt-8 border-t border-slate-50 text-center text-[8px] text-slate-300 font-bold tracking-widest uppercase">
                    Este documento es una representación impresa de un CFDI v4.0
                </div>
            )
        };

        return (
            <div className="flex flex-col" style={{ gap: `${config_adicional.spacing.section_gap}px` }}>
                {config_adicional.sections_order.map(key => sections[key])}
            </div>
        );
    };

    useEffect(() => {
        const fonts = {
            'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700;900&display=swap',
            'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;900&display=swap',
            'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;700;900&display=swap',
            'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;700;800&display=swap',
            'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap'
        };

        const fontUrl = fonts[commonData.font];
        if (fontUrl) {
            const linkId = 'font-preview-link';
            let link = document.getElementById(linkId);
            if (!link) {
                link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                document.head.appendChild(link);
            }
            link.href = fontUrl;
        }
    }, [commonData.font]);

    return (
            <div 
                className={`w-full bg-white shadow-2xl relative transition-all duration-500 ${layout === 'v6' ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}
                style={{ 
                    fontFamily: commonData.font,
                    padding: `${config_adicional.spacing.page_padding}px`,
                    minHeight: '842px'
                }}
            >
            {renderLayout()}
        </div>
    );
};


export const DiseñadorFactura = () => {
    const { activeEmisor } = useAuth();
    const [config, setConfig] = useState({
        color_primario: '#004481',
        color_secundario: '#123247',
        tipo_letra: 'Arial',
        layout_id: 'v1',
        template_mapping: {},
        logo_url: null,
        config_adicional: {
            visible_sections: {
                header: true,
                info: true,
                concepts: true,
                totals: true,
                stamps: true,
                footer: true
            },
            sections_order: ['header', 'info', 'concepts', 'totals', 'stamps', 'footer'],
            spacing: {
                page_padding: 60,
                section_gap: 40,
                font_size: 10
            }
        }
    });
    const [docTypes, setDocTypes] = useState([]);
    const [logoPreview, setLogoPreview] = useState(null);
    const [selectedLogo, setSelectedLogo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (!activeEmisor) return;
        fetchEstilo();
        fetchCatalogs();
    }, [activeEmisor]);

    const fetchCatalogs = async () => {
        try {
            const { data } = await api.get('/catalogos/tipos-documento');
            console.log("Tipos de Documento fetched:", data);
            if (data && data.length > 0) {
                setDocTypes(data);
            } else {
                setDocTypes([
                    { clave: 1, descripcion: 'FACTURA', tipo: 'I' },
                    { clave: 2, descripcion: 'RECIBO DE HONORARIOS', tipo: 'I' },
                    { clave: 3, descripcion: 'NOTA DE CRÉDITO', tipo: 'E' },
                    { clave: 8, descripcion: 'FACTURA GLOBAL', tipo: 'I' }
                ]);
            }
        } catch (error) {
            console.error("Error fetching doc types", error);
            setDocTypes([
                { clave: 1, descripcion: 'FACTURA', tipo: 'I' },
                { clave: 2, descripcion: 'RECIBO DE HONORARIOS', tipo: 'I' },
                { clave: 3, descripcion: 'NOTA DE CRÉDITO', tipo: 'E' },
                { clave: 8, descripcion: 'FACTURA GLOBAL', tipo: 'I' }
            ]);
        }
    };

    const fetchEstilo = async () => {
        try {
            const { data } = await api.get(`/estilos/${activeEmisor.id}`);
            if (data.id) {
                setConfig({
                    ...data,
                    template_mapping: data.template_mapping || {},
                    config_adicional: data.config_adicional || {
                        visible_sections: {
                            header: true,
                            info: true,
                            concepts: true,
                            totals: true,
                            stamps: true,
                            footer: true
                        },
                        sections_order: ['header', 'info', 'concepts', 'totals', 'stamps', 'footer'],
                        spacing: {
                            page_padding: 60,
                            section_gap: 40,
                            font_size: 10
                        }
                    }
                });
                if (data.logo_url) {
                    const fullUrl = data.logo_url.startsWith('http')
                        ? data.logo_url
                        : `${import.meta.env.VITE_API_URL.replace('/api', '')}${data.logo_url}`;
                    setLogoPreview(fullUrl);
                }
            }
            setLoading(false);
        } catch (error) {
            console.error("Error fetching estilo", error);
            setLoading(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedLogo(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('color_primario', config.color_primario);
            formData.append('color_secundario', config.color_secundario);
            formData.append('tipo_letra', config.tipo_letra);
            formData.append('layout_id', config.layout_id);
            formData.append('template_mapping', JSON.stringify(config.template_mapping || {}));
            formData.append('config_adicional', JSON.stringify(config.config_adicional || {}));
            if (selectedLogo) {
                formData.append('logo', selectedLogo);
            }

            await api.put(`/estilos/${activeEmisor.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            showToast("✅ Configuración de diseño guardada");
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Error saving estilo", error);
            showToast("No se pudo guardar el diseño", "error");
        } finally {
            setSaving(false);
        }
    };

    const handlePreviewPdf = async (tipo_documento_id = null) => {
        setIsGeneratingPdf(true);
        try {
            const previewData = {
                ...config,
                tipo_documento_id: tipo_documento_id
            };
            const res = await api.post(`/emisores/${activeEmisor.id}/preview-pdf`, previewData);
            const baseUrl = (api.defaults.baseURL || '/api').replace('/api', '');
            const fullUrl = res.data.pdfUrl.startsWith('http') ? res.data.pdfUrl : `${baseUrl}${res.data.pdfUrl}`;
            window.open(fullUrl, '_blank');
        } catch (error) {
            console.error("Error generating preview PDF", error);
            showToast(`Error al generar la vista previa: ${error.response?.data?.message || error.message}`, "error");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando...</div>;

    if (!activeEmisor) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-slate-500">Selecciona un emisor para configurar el diseño.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] overflow-hidden">
            <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary-500" /> Personalizar Diseño
                    </h3>
                    {saveSuccess && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Logotipo</label>
                        <div className="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-lg p-4 transition-colors hover:border-primary-400">
                            {logoPreview ? (
                                <img src={logoPreview} alt="Logo Preview" className="max-h-24 mx-auto object-contain" />
                            ) : (
                                <div className="text-center py-4">
                                    <Upload className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                    <span className="text-xs text-slate-400">Subir Imagen</span>
                                </div>
                            )}
                            <input type="file" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Colores Corporativos</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] text-slate-400 mb-1 block uppercase font-bold">Primario</span>
                                <div className="flex items-center gap-2">
                                    <button className="w-8 h-8 rounded-lg border shadow-sm" style={{ backgroundColor: config.color_primario }} onClick={() => setShowColorPicker(showColorPicker === 'primario' ? null : 'primario')} />
                                    <input type="text" value={config.color_primario} onChange={(e) => setConfig({ ...config, color_primario: e.target.value })} className="w-full text-[10px] border rounded px-2 py-1 uppercase font-mono" />
                                </div>
                                {showColorPicker === 'primario' && (
                                    <div className="absolute z-50 mt-2">
                                        <div className="fixed inset-0" onClick={() => setShowColorPicker(null)} />
                                        <SketchPicker color={config.color_primario} onChange={(c) => setConfig({ ...config, color_primario: c.hex })} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 mb-1 block uppercase font-bold">Secundario</span>
                                <div className="flex items-center gap-2">
                                    <button className="w-8 h-8 rounded-lg border shadow-sm" style={{ backgroundColor: config.color_secundario }} onClick={() => setShowColorPicker(showColorPicker === 'secundario' ? null : 'secundario')} />
                                    <input type="text" value={config.color_secundario} onChange={(e) => setConfig({ ...config, color_secundario: e.target.value })} className="w-full text-[10px] border rounded px-2 py-1 uppercase font-mono" />
                                </div>
                                {showColorPicker === 'secundario' && (
                                    <div className="absolute z-50 mt-2">
                                        <div className="fixed inset-0" onClick={() => setShowColorPicker(null)} />
                                        <SketchPicker color={config.color_secundario} onChange={(c) => setConfig({ ...config, color_secundario: c.hex })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipografía</label>
                        <select value={config.tipo_letra} onChange={(e) => setConfig({ ...config, tipo_letra: e.target.value })} className="w-full text-sm border rounded-lg px-3 py-2 bg-white outline-none focus:border-primary-500 shadow-sm">
                            {['Arial', 'Roboto', 'Inter', 'Montserrat', 'Open Sans', 'Playfair Display', 'Outfit', 'Raleway'].map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Plantilla Global</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 1, name: 'Estándar' }, { id: 2, name: 'Moderna' }, 
                                { id: 3, name: 'Elegante' }, { id: 4, name: 'Minimalista' },
                                { id: 5, name: 'Corporativa' }, { id: 6, name: 'Tecnológica' },
                                { id: 7, name: 'Tradicional Pro' }, { id: 8, name: 'Contemporánea' },
                                { id: 9, name: 'Ejecutiva' }, { id: 10, name: 'Gubernamental' },
                                { id: 11, name: 'Industrial' }, { id: 12, name: 'Premium Detail' }
                            ].map(v => (
                                <button
                                    key={v.id}
                                    className={`p-2 border rounded-lg text-[10px] font-medium transition-all ${config.layout_id === `v${v.id}` ? 'border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-100' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                    onClick={() => setConfig({ ...config, layout_id: `v${v.id}` })}
                                >
                                    <Layout className="w-3 h-3 mx-auto mb-1" />
                                    {v.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mapping por Documento */}
                    {docTypes.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Asignación por Documento</label>
                            <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                {docTypes
                                    .filter(t => t.clave !== 6 && t.clave !== 7)
                                    .map(type => (
                                        <div key={type.clave} className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-500 truncate">{type.descripcion}</span>
                                                <button onClick={() => handlePreviewPdf(type.clave)} className="p-1 hover:bg-white rounded text-slate-400 hover:text-primary-500 transition-colors">
                                                    <Eye className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <select
                                                value={config.template_mapping[type.clave] || ''}
                                                onChange={(e) => setConfig({...config, template_mapping: {...config.template_mapping, [type.clave]: e.target.value}})}
                                                className="w-full text-[10px] border border-slate-200 rounded-lg px-2 py-1.5 focus:border-primary-400 bg-white outline-none"
                                            >
                                                <option value="">(Usar Global)</option>
                                                {Array.from({ length: 12 }, (_, i) => `v${i + 1}`).map(vnum => (
                                                    <option key={vnum} value={vnum}>Plantilla {vnum.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Configuración Modular */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Configuración Modular</label>
                        
                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Visibilidad y Orden</span>
                                <div className="space-y-2">
                                    {config.config_adicional.sections_order.map((section, index) => (
                                        <div key={section} className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-2 shadow-sm group">
                                            <button 
                                                onClick={() => setConfig({
                                                    ...config,
                                                    config_adicional: {
                                                        ...config.config_adicional,
                                                        visible_sections: {
                                                            ...config.config_adicional.visible_sections,
                                                            [section]: !config.config_adicional.visible_sections[section]
                                                        }
                                                    }
                                                })}
                                                className={`p-1.5 rounded-lg transition-all ${config.config_adicional.visible_sections[section] ? 'bg-primary-500 text-white shadow-md shadow-primary-200' : 'bg-slate-100 text-slate-300'}`}
                                            >
                                                {config.config_adicional.visible_sections[section] ? <Check className="w-3 h-3" /> : <div className="w-3 h-3" />}
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-600 capitalize flex-1">{section}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    disabled={index === 0}
                                                    onClick={() => {
                                                        const newOrder = [...config.config_adicional.sections_order];
                                                        [newOrder[index], newOrder[index-1]] = [newOrder[index-1], newOrder[index]];
                                                        setConfig({...config, config_adicional: {...config.config_adicional, sections_order: newOrder}});
                                                    }}
                                                    className="p-1 hover:bg-slate-50 rounded text-slate-400 disabled:opacity-30"
                                                >
                                                    <Palette className="w-3 h-3 rotate-180" />
                                                </button>
                                                <button 
                                                    disabled={index === config.config_adicional.sections_order.length - 1}
                                                    onClick={() => {
                                                        const newOrder = [...config.config_adicional.sections_order];
                                                        [newOrder[index], newOrder[index+1]] = [newOrder[index+1], newOrder[index]];
                                                        setConfig({...config, config_adicional: {...config.config_adicional, sections_order: newOrder}});
                                                    }}
                                                    className="p-1 hover:bg-slate-50 rounded text-slate-400 disabled:opacity-30"
                                                >
                                                    <Palette className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Espaciado (px)</span>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-slate-600">Margen Página</span>
                                        <input 
                                            type="number" 
                                            value={config.config_adicional.spacing.page_padding}
                                            onChange={(e) => setConfig({...config, config_adicional: {...config.config_adicional, spacing: {...config.config_adicional.spacing, page_padding: parseInt(e.target.value)}}})}
                                            className="w-16 text-right text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary-500 shadow-sm"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-slate-600">Gaps Secciones</span>
                                        <input 
                                            type="number" 
                                            value={config.config_adicional.spacing.section_gap}
                                            onChange={(e) => setConfig({...config, config_adicional: {...config.config_adicional, spacing: {...config.config_adicional.spacing, section_gap: parseInt(e.target.value)}}})}
                                            className="w-16 text-right text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary-500 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/30 space-y-3">
                    <button onClick={() => handlePreviewPdf()} disabled={isGeneratingPdf} className="w-full bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all hover:bg-slate-50 disabled:opacity-50 shadow-sm">
                        {isGeneratingPdf ? 'Generando...' : <><Eye className="w-4 h-4 text-primary-500" /> Vista Previa PDF</>}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-200 disabled:opacity-50">
                        {saving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Cambios</>}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Vista Previa Visual</span>
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-inner overflow-y-auto p-12 flex justify-center items-start scrollbar-thin scrollbar-thumb-slate-200 text-slate-800">
                    <RenderMockup config={config} activeEmisor={activeEmisor} logoPreview={logoPreview} />
                </div>
            </div>
        </div>
    );
};

export default DiseñadorFactura;
