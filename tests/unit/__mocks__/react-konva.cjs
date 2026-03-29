const React = require('react');

const INVALID_DOM_PROPS = new Set([
  'rotateEnabled',
  'boundBoxFunc',
  'onDblClick',
  'onDragMove',
  'onDragEnd',
  'onTransformEnd',
  'onClick',
  'onTap',
  'onDblTap',
  'onMouseDown',
  'onMouseMove',
  'onMouseUp',
  'onMouseEnter',
  'onMouseLeave',
  'onWheel',
  'onContextMenu',
  'draggable',
  'hitFunc',
  'perfectDrawEnabled',
  'shadowForStrokeEnabled',
  'transformsEnabled',
  'transformsEnabled',
  'channel',
]);

const filterInvalidProps = (props) => {
  const filtered = {};
  for (const key of Object.keys(props)) {
    if (!INVALID_DOM_PROPS.has(key)) {
      filtered[key] = props[key];
    }
  }
  return filtered;
};

const createMockRef = () => ({
  current: {
    nodes: () => {},
    getLayer: () => ({ batchDraw: () => {} }),
  },
});

const mockStage = React.forwardRef((props, ref) => {
  const { 'data-testid': dataTestid, onMouseDown, onMouseMove, onMouseUp, onDblClick, onKeyDown, tabIndex, children, ...rest } = props;
  
  return React.createElement('div', {
    ref,
    'data-testid': dataTestid || 'sprite-canvas',
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDblClick,
    onKeyDown,
    tabIndex: 0,
    ...filterInvalidProps(rest),
  }, children);
});
mockStage.displayName = 'Stage';

const mockLayer = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
mockLayer.displayName = 'Layer';

const MockRect = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockRect.displayName = 'Rect';

const MockEllipse = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockEllipse.displayName = 'Ellipse';

const MockLine = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockLine.displayName = 'Line';

const MockText = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockText.displayName = 'Text';

const MockCircle = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockCircle.displayName = 'Circle';

const MockPolyline = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockPolyline.displayName = 'Polyline';

const MockTransformer = React.forwardRef((props, ref) => {
  const transformerRef = React.useRef({
    nodes: () => {},
    getLayer: () => ({ batchDraw: () => {} }),
  });
  
  React.useImperativeHandle(ref, () => transformerRef.current);
  
  const { children, ...rest } = props;
  return React.createElement('div', { ref, ...filterInvalidProps(rest) }, children);
});
MockTransformer.displayName = 'Transformer';

module.exports = {
  Stage: mockStage,
  Layer: mockLayer,
  Rect: MockRect,
  Ellipse: MockEllipse,
  Line: MockLine,
  Text: MockText,
  Circle: MockCircle,
  Polyline: MockPolyline,
  Transformer: MockTransformer,
};
module.exports.default = module.exports;
