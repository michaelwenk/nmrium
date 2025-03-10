import { v4 } from '@lukeed/uuid';
import { original, Draft } from 'immer';
import { Spectrum, Spectrum1D, Spectrum2D } from 'nmr-load-save';

import { contoursManager } from '../../../data/data2d/Spectrum2D/contours';
import { Nucleus } from '../../../data/types/common/Nucleus';
import { getYScale, getXScale } from '../../1d/utilities/scale';
import { LAYOUT, Layout } from '../../2d/utilities/DimensionLayout';
import { get2DYScale } from '../../2d/utilities/scale';
import { defaultRangesViewState } from '../../hooks/useActiveSpectrumRangesViewState';
import { Tool, options as Tools } from '../../toolbar/ToolTypes';
import groupByInfoKey from '../../utility/GroupByInfoKey';
import { getSpectraByNucleus } from '../../utility/getSpectraByNucleus';
import { State } from '../Reducer';
import { MARGIN } from '../core/Constants';
import {
  setZoom,
  toScaleRatio,
  wheelZoom,
  ZOOM_TYPES,
  ZoomType,
} from '../helper/Zoom1DManager';
import zoomHistoryManager, {
  addToBrushHistory,
} from '../helper/ZoomHistoryManager';
import { getActiveSpectra } from '../helper/getActiveSpectra';
import { getActiveSpectrum } from '../helper/getActiveSpectrum';
import { getTwoDimensionPhaseCorrectionOptions } from '../helper/getTwoDimensionPhaseCorrectionOptions';
import { getVerticalAlign } from '../helper/getVerticalAlign';
import { setIntegralsViewProperty } from '../helper/setIntegralsViewProperty';
import { setRangesViewProperty } from '../helper/setRangesViewProperty';
import { ActionType } from '../types/ActionType';

import { setDomain, SetDomainOptions, setMode } from './DomainActions';
import {
  calculateBaseLineCorrection,
  rollbackSpectrumByFilter,
  rollbackSpectrum,
} from './FiltersActions';
import { changeSpectrumVerticalAlignment } from './PreferencesActions';

interface BrushBoundary {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  trackID?: Layout | null;
}
interface ResetToolOptions {
  resetToDefaultTool?: boolean;
  defaultToolId?: Tool;
  resetSpectrum?: boolean;
  resetFiltersOptionPanel?: boolean;
}

interface SetActiveTabOptions {
  tab?: Nucleus | null;
  refreshActiveTab?: boolean;
  domainOptions?: SetDomainOptions;
}

type SetSelectedToolAction = ActionType<
  'SET_SELECTED_TOOL',
  { selectedTool: Tool }
>;

type AddBaseLineZoneAction = ActionType<
  'ADD_BASE_LINE_ZONE',
  { startX: number; endX: number }
>;
type DeleteBaseLineZoneAction = ActionType<
  'DELETE_BASE_LINE_ZONE',
  { id: string }
>;

type BrushEndAction = ActionType<'BRUSH_END', BrushBoundary>;

type ZoomAction = ActionType<
  'SET_ZOOM',
  { event: any; trackID?: Layout; selectedTool?: Tool }
>;

type ZoomOutAction = ActionType<
  'FULL_ZOOM_OUT',
  { zoomType?: ZoomType; trackID?: Layout }
>;
type SetActiveTabAction = ActionType<'SET_ACTIVE_TAB', { tab?: Nucleus }>;
type LevelChangeAction = ActionType<
  'SET_2D_LEVEL',
  { deltaY: number; shiftKey: boolean }
>;

export type ToolsActions =
  | ActionType<
      | 'TOGGLE_REAL_IMAGINARY_VISIBILITY'
      | 'RESET_SELECTED_TOOL'
      | 'SET_SPECTRUMS_VERTICAL_ALIGN'
      | 'CHANGE_SPECTRUM_DISPLAY_VIEW_MODE'
      | 'SET_SPECTRA_SAME_TOP'
      | 'RESET_SPECTRA_SCALE'
    >
  | SetSelectedToolAction
  | AddBaseLineZoneAction
  | DeleteBaseLineZoneAction
  | BrushEndAction
  | ZoomAction
  | ZoomOutAction
  | SetActiveTabAction
  | LevelChangeAction;

function resetTool(draft: Draft<State>, options: ResetToolOptions = {}) {
  const {
    resetToDefaultTool = true,
    resetFiltersOptionPanel = true,
    defaultToolId = 'zoom',
    resetSpectrum = false,
  } = options;
  // reset temp range
  if (resetFiltersOptionPanel) {
    draft.toolOptions.selectedOptionPanel = null;
  }
  if (resetToDefaultTool) {
    draft.toolOptions.selectedTool = defaultToolId;
  }

  if (
    (draft.toolOptions.data.activeFilterID || draft.tempData) &&
    resetSpectrum
  ) {
    rollbackSpectrumByFilter(draft, { reset: true });
  }
}

function handleResetSelectedTool(draft: Draft<State>) {
  resetSelectedTool(draft);
}
function resetSelectedTool(draft: Draft<State>, filterOnly = false) {
  if (
    (draft.toolOptions.selectedTool &&
      Tools[draft.toolOptions.selectedTool].isFilter) ||
    !filterOnly
  ) {
    resetTool(draft, { resetSpectrum: true });
  }
}

interface ActivateToolOptions {
  toolId: string;
  reset?: boolean;
}

//utility
function activateTool(draft, options: ActivateToolOptions) {
  const { toolId, reset = false } = options;

  if (draft?.data.length > 0) {
    if (toolId) {
      // start Range edit mode
      if (toolId === Tools.editRange.id) {
        const activeSpectrum = getActiveSpectrum(draft);
        if (activeSpectrum) {
          const range = draft.view.ranges?.[activeSpectrum?.id];
          if (range) {
            range.showMultiplicityTrees = true;
          } else {
            draft.view.ranges[activeSpectrum.id] = {
              ...defaultRangesViewState,
              showMultiplicityTrees: true,
            };
          }
        }
      }

      if (toolId !== draft.toolOptions.selectedTool) {
        resetTool(draft, { resetToDefaultTool: false });
      }

      draft.toolOptions.selectedTool = toolId;
      if (Tools[toolId]?.hasOptionPanel) {
        draft.toolOptions.selectedOptionPanel = toolId;
      }

      if (Tools?.[toolId]?.isFilter) {
        rollbackSpectrum(draft, { filterKey: toolId, reset });
      }
    } else {
      resetTool(draft, { resetToDefaultTool: false });
    }
    setMargin(draft);
  }
}

function setSelectedTool(draft: Draft<State>, action: SetSelectedToolAction) {
  const { selectedTool } = action.payload;
  activateTool(draft, { toolId: selectedTool });
}
//utility
function getSpectrumID(draft: Draft<State>, index): string | null {
  const { activeSpectra, activeTab } = draft.view.spectra;

  const spectra = activeSpectra[activeTab.split(',')[index]];

  if (spectra?.length === 1) {
    return spectra[0].id;
  }

  return null;
}

function setSpectrumsVerticalAlign(draft: Draft<State>) {
  const currentVerticalAlign = getVerticalAlign(draft);
  const verticalAlign = ['stack', 'bottom'].includes(currentVerticalAlign)
    ? 'center'
    : 'bottom';
  changeSpectrumVerticalAlignment(draft, { verticalAlign });
}

function handleChangeSpectrumDisplayMode(draft: Draft<State>) {
  const currentVerticalAlign = getVerticalAlign(draft);
  const verticalAlign = currentVerticalAlign === 'stack' ? 'bottom' : 'stack';
  changeSpectrumVerticalAlignment(draft, { verticalAlign });
}

function handleAddBaseLineZone(
  draft: Draft<State>,
  action: AddBaseLineZoneAction,
) {
  const scaleX = getXScale(draft);
  const { startX, endX } = action.payload;
  const start = scaleX.invert(startX);
  const end = scaleX.invert(endX);

  let zone: any = [];
  if (start > end) {
    zone = [end, start];
  } else {
    zone = [start, end];
  }
  const zones = draft.toolOptions.data.baselineCorrection.zones;
  zones.push({
    id: v4(),
    from: zone[0],
    to: zone[1],
  });
  draft.toolOptions.data.baselineCorrection.zones = zones.slice();

  calculateBaseLineCorrection(draft);
}

function handleDeleteBaseLineZone(
  draft: Draft<State>,
  action: DeleteBaseLineZoneAction,
) {
  const { id } = action.payload;
  const state = original(draft) as State;
  draft.toolOptions.data.baselineCorrection.zones =
    state.toolOptions.data.baselineCorrection.zones.filter(
      (zone) => zone.id !== id,
    );
  calculateBaseLineCorrection(draft);
}

function handleToggleRealImaginaryVisibility(draft: Draft<State>) {
  const activeSpectrum = getActiveSpectrum(draft);

  if (activeSpectrum != null) {
    const { index } = activeSpectrum;
    const datum = draft.data[index] as Spectrum1D;

    datum.display.isRealSpectrumVisible = !datum.display.isRealSpectrumVisible;

    setDomain(draft);
  }
}

function handleBrushEnd(draft: Draft<State>, action: BrushEndAction) {
  const is2D = draft.displayerMode === '2D';

  const { height, margin, yDomain, yDomains, width, xDomains, xDomain, mode } =
    draft;

  const xScale = getXScale({ width, xDomains, xDomain, mode, margin });
  const verticalAlign = getVerticalAlign(draft);
  const yScale = is2D
    ? get2DYScale(draft)
    : getYScale({ height, margin, yDomain, yDomains, verticalAlign });

  const {
    startX: _startX,
    endX: _endX,
    startY: _startY,
    endY: _endY,
    trackID,
  } = action.payload;

  const startX = xScale.invert(_startX);
  const endX = xScale.invert(_endX);
  const startY = yScale.invert(_startY);
  const endY = yScale.invert(_endY);
  const domainX = startX > endX ? [endX, startX] : [startX, endX];
  const domainY = startY > endY ? [endY, startY] : [startY, endY];
  addToBrushHistory(draft, { trackID, xDomain: domainX, yDomain: domainY });
}

function handleZoom(draft: Draft<State>, action: ZoomAction) {
  const { event, trackID } = action.payload;
  const {
    displayerMode,
    yDomains,
    toolOptions: { selectedTool },
  } = draft;
  const scaleRatio = toScaleRatio(event);
  switch (displayerMode) {
    case '2D': {
      // change the vertical scale for traces in 2D phase correction
      if (
        selectedTool === 'phaseCorrectionTwoDimensions' &&
        trackID === 'CENTER_2D'
      ) {
        const { activeTraces } = getTwoDimensionPhaseCorrectionOptions(draft);
        activeTraces.scaleRatio *= scaleRatio;
      } else {
        // change the vertical scale of 1D traces
        const index =
          trackID === LAYOUT.TOP_1D ? 0 : trackID === LAYOUT.LEFT_1D ? 1 : null;
        if (index !== null) {
          const id = getSpectrumID(draft, index);
          if (id) {
            const domain = yDomains[id];
            yDomains[id] = wheelZoom(event, domain);
          }
        }
      }

      break;
    }

    case '1D': {
      const activeSpectra = getActiveSpectra(draft);

      if (!activeSpectra) {
        // rescale the spectra
        for (const key of Object.keys(yDomains)) {
          const domain = yDomains[key];
          yDomains[key] = wheelZoom(event, domain);
        }
        return;
      }

      if (activeSpectra.length === 1 && event.shiftKey) {
        switch (selectedTool) {
          case 'rangePicking': {
            setRangesViewProperty(
              draft,
              'integralsScaleRatio',
              (scale) => scale * scaleRatio,
            );
            break;
          }
          case 'integral': {
            setIntegralsViewProperty(
              draft,
              'scaleRatio',
              (scale) => scale * scaleRatio,
            );
            break;
          }
          default:
            break;
        }
      } else {
        for (const activeSpectrum of activeSpectra) {
          const domain = yDomains?.[activeSpectrum?.id];
          if (domain) {
            yDomains[activeSpectrum?.id] = wheelZoom(event, domain);
          }
        }
      }

      break;
    }

    default:
      break;
  }
}

function zoomOut(draft: Draft<State>, action: ZoomOutAction) {
  if (draft?.data.length > 0) {
    const { zoomType, trackID } = action?.payload || {};
    const { xDomain, yDomain } = draft.originDomain;
    const zoomHistory = zoomHistoryManager(
      draft.zoom.history,
      draft.view.spectra.activeTab,
      { xDomain, yDomain },
    );

    if (draft.displayerMode === '1D') {
      switch (zoomType) {
        case ZOOM_TYPES.HORIZONTAL: {
          draft.xDomain = xDomain;
          zoomHistory.clear();
          break;
        }
        case ZOOM_TYPES.VERTICAL:
          setZoom(draft, { scale: 0.8 });
          break;
        case ZOOM_TYPES.STEP_HORIZONTAL: {
          const zoomValue = zoomHistory.pop();
          if (zoomValue) {
            draft.xDomain = zoomValue.xDomain;
          } else {
            setZoom(draft, { scale: 0.8 });
          }
          break;
        }
        default: {
          draft.xDomain = xDomain;
          setZoom(draft, { scale: 0.8 });
          zoomHistory.clear();
          break;
        }
      }
    } else {
      const { xDomain, yDomain, yDomains } = draft.originDomain;

      if (trackID) {
        const zoomValue = zoomHistory.pop();
        draft.xDomain = zoomValue ? zoomValue.xDomain : xDomain;
        draft.yDomain = zoomValue ? zoomValue.yDomain : yDomain;
      } else {
        zoomHistory.clear();
        draft.xDomain = xDomain;
        draft.yDomain = yDomain;
        draft.yDomains = yDomains;
      }
    }
  }
}

//utility
function hasAcceptedSpectrum(draft: Draft<State>, index) {
  const { activeTab, activeSpectra } = draft.view.spectra;
  const nuclei = activeTab.split(',');
  const spectra = activeSpectra[nuclei[index]];

  if (spectra?.length === 1) {
    const activeSpectrum = spectra[0];
    return (
      activeSpectrum?.id &&
      !(draft.data[activeSpectrum.index] as Spectrum1D).info.isFid
    );
  }

  return false;
}

//utility
function setMargin(draft: Draft<State>) {
  const activeSpectrum = getActiveSpectrum(draft);
  const spectrum =
    (activeSpectrum?.id && draft.data[activeSpectrum.index]) || null;

  if (
    draft.displayerMode === '2D' &&
    (draft.toolOptions.selectedTool === Tools.slicing.id ||
      spectrum?.info.isFid)
  ) {
    draft.margin = MARGIN['2D'];
  } else if (draft.displayerMode === '2D') {
    const top = hasAcceptedSpectrum(draft, 0)
      ? MARGIN['2D'].top
      : MARGIN['1D'].top;
    const left = hasAcceptedSpectrum(draft, 1)
      ? MARGIN['2D'].left
      : MARGIN['1D'].left;
    draft.margin = { ...MARGIN['2D'], top, left };
  } else if (draft.displayerMode === '1D') {
    draft.margin = MARGIN['1D'];
  }
}

//utility
function setDisplayerMode(draft: Draft<State>, data) {
  draft.displayerMode =
    data && (data as Spectrum[]).some((d) => d.info.dimension === 2)
      ? '2D'
      : '1D';
}

//utility
function setTabActiveSpectrum(draft: Draft<State>, dataGroupByTab) {
  const tabs2D: any[] = [];
  const tabActiveSpectrum = {};

  const tabkeys = Object.keys(dataGroupByTab).sort((a, b) =>
    a.split(',').length > b.split(',').length ? -1 : 1,
  );
  for (const tabKey of tabkeys) {
    const data = dataGroupByTab[tabKey];
    const nucleusLength = tabKey.split(',').length;
    if (nucleusLength === 2) {
      tabs2D.push(tabKey);
    }

    if (data.length === 1) {
      const index = draft.data.findIndex((datum) => datum.id === data[0].id);
      tabActiveSpectrum[tabKey] = [{ id: data[0].id, index, selected: true }];
    } else {
      const tabSpectra = dataGroupByTab[tabKey];
      const tabSpectraLength = tabSpectra.length;
      if (tabSpectraLength >= 2) {
        const FTSpectrums = tabSpectra.filter((d) => !d.info.isFid);
        if (FTSpectrums.length > 0) {
          const selected =
            nucleusLength === 2 ||
            (nucleusLength === 1 && tabSpectraLength !== FTSpectrums.length);
          const index = draft.data.findIndex(
            (datum) => datum.id === FTSpectrums[0].id,
          );
          tabActiveSpectrum[tabKey] = [
            { id: FTSpectrums[0].id, index, selected },
          ];
        } else if (tabSpectraLength - FTSpectrums > 0) {
          const id = tabSpectra[0].id;
          const index = draft.data.findIndex((datum) => datum.id === id);
          tabActiveSpectrum[tabKey] = [{ id, index, selected: true }];
        } else {
          tabActiveSpectrum[tabKey] = null;
        }
      } else {
        tabActiveSpectrum[tabKey] = null;
      }
    }
  }
  draft.view.spectra.activeSpectra = tabActiveSpectrum;
  return tabs2D;
}

//utility
function setTab(draft: Draft<State>, dataGroupByTab, tab, refresh = false) {
  const groupByTab = Object.keys(dataGroupByTab).sort((a, b) =>
    a.split(',').length > b.split(',').length ? -1 : 1,
  );

  if (
    JSON.stringify(groupByTab) !==
      JSON.stringify(Object.keys(draft.view.spectra.activeSpectra)) ||
    refresh
  ) {
    const tabs2D = setTabActiveSpectrum(draft, dataGroupByTab);

    if (tabs2D.length > 0 && tab == null) {
      draft.view.spectra.activeTab = tabs2D[0];
    } else {
      draft.view.spectra.activeTab = !groupByTab.includes(tab)
        ? groupByTab[0]
        : tab;
    }
  } else if (tab) {
    draft.view.spectra.activeTab = tab;
  }

  setDisplayerMode(draft, dataGroupByTab[draft.view.spectra.activeTab]);
  setMargin(draft);
}

//utility
function setActiveTab(draft: Draft<State>, options?: SetActiveTabOptions) {
  const {
    tab = null,
    refreshActiveTab = false,
    domainOptions = {},
  } = options || {};

  const groupByNucleus = groupByInfoKey('nucleus');
  const dataGroupByNucleus = groupByNucleus(draft.data, true);
  setTab(draft, dataGroupByNucleus, tab, refreshActiveTab);
  resetTool(draft);

  setDomain(draft, domainOptions);
  const zoomHistory = zoomHistoryManager(
    draft.zoom.history,
    draft.view.spectra.activeTab,
  );
  const zoomValue = zoomHistory.getLast();
  if (zoomValue) {
    draft.xDomain = zoomValue.xDomain;
    draft.yDomain = zoomValue.yDomain;
  }
  setMode(draft);
}

function handelSetActiveTab(draft: Draft<State>, action: SetActiveTabAction) {
  const { tab } = action.payload;
  if (tab) {
    setActiveTab(draft, { tab });
  }
}

function levelChangeHandler(draft: Draft<State>, action: LevelChangeAction) {
  const { deltaY, shiftKey } = action.payload;
  const {
    data,
    view: {
      spectra: { activeTab },
      zoom: { levels },
    },
  } = draft;
  const activeSpectra = getActiveSpectra(draft) || [];

  const activeSpectraObj = {};
  for (const activeSpectrum of activeSpectra) {
    activeSpectraObj[activeSpectrum.id] = true;
  }

  const spectra = getSpectraByNucleus(activeTab, data).filter(
    (spectrum) =>
      spectrum.info.isFt &&
      (activeSpectraObj?.[spectrum.id] || activeSpectra.length === 0),
  );

  try {
    for (const spectrum of spectra as Spectrum2D[]) {
      const contourOptions = spectrum.display.contourOptions;
      const zoom = contoursManager(spectrum.id, levels, contourOptions);
      levels[spectrum.id] = zoom.wheel(deltaY, shiftKey);
    }
  } catch (error) {
    // TODO: handle error.
    reportError(error);
  }
}

function setSpectraSameTopHandler(draft: Draft<State>) {
  if (draft.displayerMode === '1D') {
    draft.originDomain.shareYDomain = false;
    setZoom(draft, { scale: 0.8 });
  }
}
function resetSpectraScale(draft: Draft<State>) {
  draft.originDomain.shareYDomain = true;
  draft.yDomains = draft.originDomain.yDomains;
  draft.yDomain = draft.originDomain.yDomain;
  setZoom(draft, { scale: 0.8 });
}

export {
  handleResetSelectedTool,
  resetSelectedTool,
  setSelectedTool,
  activateTool,
  setSpectrumsVerticalAlign,
  handleChangeSpectrumDisplayMode,
  handleAddBaseLineZone,
  handleDeleteBaseLineZone,
  handleToggleRealImaginaryVisibility,
  handleBrushEnd,
  handleZoom,
  zoomOut,
  handelSetActiveTab,
  levelChangeHandler,
  setActiveTab,
  setTab,
  setSpectraSameTopHandler,
  resetSpectraScale,
  setMargin,
};
