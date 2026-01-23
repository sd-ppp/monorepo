import React from 'react';
import { WidgetRenderer } from '../widget-registry';
import { NumberWidget } from './widgets/number';
import { ComboWidget } from './widgets/combo';
import { ToggleWidget } from './widgets/toggle';
import { StringWidget } from './widgets/string';
import { SegmentWidget } from './widgets/segment';
import { WidgetableNumberWidget, WidgetableComboWidget, WidgetableToggleWidget, WidgetableStringWidget, WidgetableSegmentWidget } from "@sdppp/common/schemas/schemas";

export const renderToggleWidget: WidgetRenderer = ({
    fieldInfo,
    widget,
    widgetIndex,
    value,
    onValueChange,
    extraOptions,
    renderMeta: _renderMeta,
}) => {
    const toggleWidget = widget as WidgetableToggleWidget;
    return (
        <ToggleWidget
            uiWeight={toggleWidget.uiWeight || 12}
            key={widgetIndex}
            name={toggleWidget.name}
            value={value || false}
            onValueChange={onValueChange}
            extraOptions={extraOptions}
        />
    );
};

export const renderNumberWidget: WidgetRenderer = ({
    fieldInfo,
    widget,
    widgetIndex,
    value,
    onValueChange,
    extraOptions,
    renderMeta: _renderMeta,
}) => {
    const numberWidget = widget as WidgetableNumberWidget;
    const min = numberWidget.options?.min ?? 0;
    const max = numberWidget.options?.max ?? 100;
    const step = numberWidget.options?.step ?? 1;
    const slider = numberWidget.options?.slider || false;

    return (
        <NumberWidget
            uiWeight={numberWidget.uiWeight || 12}
            key={widgetIndex}
            inputMin={min}
            inputMax={max}
            inputStep={step}
            name={numberWidget.name}
            value={parseFloat(value || 0)}
            onValueChange={onValueChange}
            extraOptions={extraOptions}
            useSlider={slider}
        />
    );
};

export const renderComboWidget: WidgetRenderer = ({
    fieldInfo,
    widget,
    widgetIndex,
    value,
    onValueChange,
    extraOptions,
    renderMeta: _renderMeta,
}) => {
    const comboWidget = widget as WidgetableComboWidget;
    return (
        <ComboWidget
            uiWeight={comboWidget.uiWeight || 12}
            key={widgetIndex}
            options={comboWidget?.options?.values || []}
            labels={comboWidget?.options?.labels || []}
            name={comboWidget.name}
            onSelectUpdate={onValueChange}
            value={value || ''}
            extraOptions={extraOptions}
        />
    );
};

export const renderSegmentWidget: WidgetRenderer = ({
    fieldInfo,
    widget,
    widgetIndex,
    value,
    onValueChange,
    extraOptions,
    renderMeta: _renderMeta,
}) => {
    const segmentWidget = widget as WidgetableSegmentWidget;
    return (
        <SegmentWidget
            uiWeight={segmentWidget.uiWeight || 12}
            key={widgetIndex}
            options={segmentWidget?.options?.values || []}
            name={segmentWidget.name}
            onSelectUpdate={onValueChange}
            value={value || ''}
            extraOptions={extraOptions}
        />
    );
};

export const renderStringWidget: WidgetRenderer = ({
    fieldInfo,
    widget,
    widgetIndex,
    value,
    onValueChange,
    extraOptions,
    renderMeta: _renderMeta,
}) => {
    const stringWidget = widget as WidgetableStringWidget;
    return (
        <StringWidget
            uiWeight={stringWidget.uiWeight || 12}
            key={widgetIndex}
            value={value || ''}
            onValueChange={onValueChange}
            extraOptions={extraOptions}
        />
    );
};

export const renderErrorWidget: WidgetRenderer = ({ widget, renderMeta: _renderMeta }) => {
    return <span>{(widget as any).value}</span>;
};
