import type { DeferredUploadSelectorSourceHints } from './types';

/**
 * 标准化预设值
 */
const normalizePreset = <T extends readonly string[]>(
  value: string | null | undefined,
  presets: T,
  fallback: T[number],
): T[number] => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  const matched = presets.find(option => option === normalized);
  return (matched ?? fallback) as T[number];
};

/**
 * 构建内容 URI
 * @param docId 文档 ID (0 表示当前活动文档)
 * @param preset 内容来源预设
 * @returns 内容 URI，如 "uxp://content/123/canvas"
 */
export const buildContentUri = (
  docId: number,
  preset?: 'canvas' | 'curlayer' | null
): string => {
  const normalized = normalizePreset(preset, ['canvas', 'curlayer'] as const, 'canvas');
  if (docId >= 0) {
    return `uxp://content/${docId}/${normalized}`;
  }
  return '';
};

/**
 * 构建边界 URI
 * @param docId 文档 ID (0 表示当前活动文档)
 * @param fallbackUri 回退 URI
 * @param preset 边界来源预设
 * @returns 边界 URI，如 "uxp://boundary/123/selection"
 */
export const buildBoundaryUri = (
  docId: number,
  fallbackUri: string,
  preset?: 'canvas' | 'curlayer' | 'selection' | null
): string => {
  const normalized = normalizePreset(preset, ['canvas', 'curlayer', 'selection'] as const, 'canvas');
  if (docId >= 0) {
    return `uxp://boundary/${docId}/${normalized}`;
  }
  return fallbackUri;
};

/**
 * 构建遮罩 URI
 * @param docId 文档 ID (0 表示当前活动文档)
 * @param preset 遮罩来源预设，null 表示不使用遮罩，'empty' 表示空遮罩
 * @param hasSelection 是否有选区
 * @returns 遮罩 URI，如 "uxp://mask/123/smart_selection"，空字符串表示不使用遮罩
 */
export const buildMaskUri = (
  docId: number,
  preset?: 'canvas' | 'curlayer' | 'selection' | 'smart_selection' | 'empty' | null,
  hasSelection?: boolean
): string => {
  if (docId < 0) return '';
  
  // 如果显式传入 null，表示不使用遮罩
  if (preset === null) {
    return '';
  }
  
  // 如果传入 'empty'，返回空遮罩 URI
  if (preset === 'empty') {
    return `uxp://mask/${docId}/empty`;
  }
  
  const normalized = normalizePreset(
    preset,
    ['canvas', 'curlayer', 'selection', 'smart_selection'] as const,
    'smart_selection'
  );
  
  if (normalized === 'smart_selection') {
    const target = hasSelection ? 'selection' : 'canvas';
    return `uxp://mask/${docId}/${target}?from=smart`;
  }
  
  return `uxp://mask/${docId}/${normalized}`;
};

/**
 * 边界主体描述映射
 */
const BOUNDARY_SUBJECTS: Record<'canvas' | 'curlayer' | 'selection', string> = {
  canvas: '',
  curlayer: '所选图层',
  selection: '选区',
};

/**
 * 遮罩主体描述映射
 */
const MASK_SUBJECTS: Partial<Record<'canvas' | 'curlayer' | 'selection' | 'smart_selection', string>> = {
  curlayer: '所选图层',
  selection: '选区',
  smart_selection: '智能选区',
};

/**
 * 根据 sourceHints 构建触发标签
 * @param sourceHints 源提示配置
 * @returns 描述性标签
 */
export const buildTriggerLabel = (
  sourceHints?: DeferredUploadSelectorSourceHints
): string => {
  const contentPreset = sourceHints?.content || 'canvas';
  const maskPreset = sourceHints?.mask || 'smart_selection';
  const boundaryPreset = sourceHints?.boundary || 'canvas';
  
  // 全部为 canvas 时的简化描述
  if (contentPreset === 'canvas' && maskPreset === 'canvas' && boundaryPreset === 'canvas') {
    return '(将会输入画布内容)';
  }
  
  // empty mask 或 null mask 的情况（canvas + empty/null + canvas）
  if (contentPreset === 'canvas' && (maskPreset === 'empty' || maskPreset === null) && boundaryPreset === 'canvas') {
    return '(将会输入当前画面)';
  }
  
  // 默认情况（canvas + smart_selection + canvas）的简化描述
  if (contentPreset === 'canvas' && maskPreset === 'smart_selection' && boundaryPreset === 'canvas') {
    return '(将会自动获取PS画面+选区遮罩)';
  }
  
  const boundarySubject = BOUNDARY_SUBJECTS[boundaryPreset];
  const maskSubject = MASK_SUBJECTS[maskPreset];
  const isSmartSelection = maskPreset === 'smart_selection';
  
  let base: string;
  
  // 构建基础描述
  if (contentPreset === 'canvas') {
    if (boundaryPreset !== 'canvas') {
      base = `将会输入边界限定在${boundarySubject}的内容`;
    } else {
      base = '将会输入当前画面';
    }
  } else {
    base = '将会输入所选图层内容';
  }
  
  // 添加边界后缀
  const boundarySuffix =
    contentPreset === 'curlayer' && boundaryPreset !== 'canvas'
      ? `，边界限定在${boundarySubject}`
      : '';
  
  // 添加遮罩后缀（empty 和 null 不添加遮罩后缀）
  let maskSuffix = '';
  if (maskPreset !== 'empty' && maskPreset !== null) {
    if (maskSubject) {
      const conjunction =
        contentPreset === 'canvas' && boundaryPreset === 'canvas' ? '，以' : '，并以';
      const suffixDetail = isSmartSelection ? '（无选区时回退至画布）' : '';
      maskSuffix = `${conjunction}${maskSubject}为遮罩${suffixDetail}`;
    } else if (isSmartSelection) {
      maskSuffix = '，智能选区为遮罩（无选区时回退至画布）';
    }
  }
  
  return `(${base}${boundarySuffix}${maskSuffix})`;
};

/**
 * 从 workBoundary URI 解析文档 ID
 * @param workBoundary 工作边界 URI，如 "uxp://boundary/123/canvas"
 * @returns 文档 ID，如果无法解析则返回 0
 */
export const parseDocIdFromWorkBoundary = (workBoundary: string): number => {
  const match = workBoundary.match(/\/(\d+)\//);
  return match ? parseInt(match[1], 10) : 0;
};
