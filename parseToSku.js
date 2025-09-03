function generateRandomId() {
  const chars = '0123456789abcdef-';
  let result = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += '-';
    } else {
      result += chars[Math.floor(Math.random() * 16)];
    }
  }
  return result;
}

function generateSpecValueId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000000);
}

// 动态单位识别器
class UnitRecognizer {
  constructor(skuOptions) {
    this.knownUnits = new Map();
    this.unitCategories = new Map();
    this.initializeFromSkuOptions(skuOptions);
  }
  
  // 从skuOptions中提取所有可能的单位信息
  initializeFromSkuOptions(skuOptions) {
    if (!skuOptions?.[0]?.additions?.measure_templates) return;
    
    const templates = skuOptions[0].additions.measure_templates;
    templates.forEach(template => {
      template.value_modules?.forEach(module => {
        if (module.unit_options?.length > 0) {
          module.unit_options.forEach(unitOption => {
            this.knownUnits.set(unitOption.label, {
              id: unitOption.value,
              moduleId: module.module_id,
              category: this.inferCategory(unitOption.label),
              source: 'template'
            });
          });
        }
      });
    });
  }
  
  // 根据单位名称推断类别
  inferCategory(unit) {
    const weightUnits = ['mg', 'g', 'kg', '克', '千克', '斤', '两', '公斤'];
    const volumeUnits = ['ml', 'l', 'L', '毫升', '升', '公升'];
    const packageUnits = ['个', '件', '瓶', '袋', '包', '盒', '支', '块', '罐', '桶', '颗', '条', '箱', '盘', '片', '贴', '根', '对', '喷'];
    const lengthUnits = ['m', 'cm', 'mm', '米', '厘米', '毫米'];
    
    if (weightUnits.includes(unit)) return 'weight';
    if (volumeUnits.includes(unit)) return 'volume';
    if (packageUnits.includes(unit)) return 'package';
    if (lengthUnits.includes(unit)) return 'length';
    return 'unknown';
  }
  
  // 获取单位信息，如果不存在则创建虚拟单位
  getUnitInfo(unit) {
    if (this.knownUnits.has(unit)) {
      return this.knownUnits.get(unit);
    }
    
    // 创建虚拟单位
    const virtualUnit = {
      id: this.generateVirtualUnitId(unit),
      moduleId: null,
      category: this.inferCategory(unit),
      source: 'virtual'
    };
    
    this.knownUnits.set(unit, virtualUnit);
    return virtualUnit;
  }
  
  // 生成虚拟单位ID
  generateVirtualUnitId(unit) {
    return 9000 + unit.charCodeAt(0) + unit.length;
  }
  
  // 获取所有已知单位的正则表达式模式
  getUnitPattern() {
    const allUnits = Array.from(this.knownUnits.keys());
    // 添加一些常见的中文单位
    const commonUnits = ['个', '件', '瓶', '袋', '包', '盒', '支', '块', '罐', '桶', '颗', '条', '箱', '盘', '片', '贴', '根', '对', '喷', 
                         'mg', 'g', 'kg', 'ml', 'l', 'L', 'm', 'cm', 'mm', '克', '斤', '两', '公斤', '毫升', '升', '米', '厘米', '毫米'];
    
    const combinedUnits = [...new Set([...allUnits, ...commonUnits])];
    // 按长度排序，长的在前面，避免匹配冲突
    combinedUnits.sort((a, b) => b.length - a.length);
    
    return combinedUnits.map(unit => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  }
}

// 智能规格解析器
class SpecParser {
  constructor(unitRecognizer) {
    this.unitRecognizer = unitRecognizer;
  }
  
  // 解析规格名称，提取所有可能的组成部分
  parseSpecName(specName) {
    const parts = [];
    let remaining = specName;
    
    // 1. 提取括号内容（各种类型的括号）
    const bracketPatterns = [
      /【([^】]+)】/g,    // 中文方括号
      /\[([^\]]+)\]/g,    // 英文方括号
      /\(([^)]+)\)/g,     // 圆括号
      /（([^）]+)）/g,     // 中文圆括号
      /"([^"]+)"/g,       // 双引号
      /'([^']+)'/g        // 单引号
    ];
    
    bracketPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(remaining)) !== null) {
        parts.push({
          type: 'text',
          value: match[0],
          rawValue: match[1],
          position: match.index
        });
        remaining = remaining.replace(match[0], ' '); // 用空格替代，保持位置
      }
    });
    
    // 2. 提取数字+单位组合
    const unitPattern = this.unitRecognizer.getUnitPattern();
    if (unitPattern) {
      const unitRegex = new RegExp(`(\\d+(?:\\.\\d+)?)(${unitPattern})`, 'g');
      let match;
      while ((match = unitRegex.exec(remaining)) !== null) {
        const unit = match[2];
        const unitInfo = this.unitRecognizer.getUnitInfo(unit);
        parts.push({
          type: 'unit',
          value: match[1],
          unit: unit,
          unitInfo: unitInfo,
          fullMatch: match[0],
          position: match.index
        });
        remaining = remaining.replace(match[0], ' ');
      }
    }
    
    // 3. 提取纯数字（可能是数量但没有单位）
    const numberRegex = /(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = numberRegex.exec(remaining)) !== null) {
      parts.push({
        type: 'number',
        value: match[1],
        fullMatch: match[0],
        position: match.index
      });
      remaining = remaining.replace(match[0], ' ');
    }
    
    // 4. 提取剩余的文本部分
    const textParts = remaining.split(/\s+/).filter(text => text.trim().length > 0);
    textParts.forEach(text => {
      if (text.trim()) {
        parts.push({
          type: 'text',
          value: text.trim(),
          rawValue: text.trim(),
          position: -1 // 位置信息已丢失
        });
      }
    });
    
    // 5. 按位置排序（如果有位置信息）
    parts.sort((a, b) => {
      if (a.position === -1 && b.position === -1) return 0;
      if (a.position === -1) return 1;
      if (b.position === -1) return -1;
      return a.position - b.position;
    });
    
    return parts;
  }
  
  // 智能合并相邻的数字和文本，形成可能的数字+单位组合
  enhanceParsedParts(parts) {
    const enhanced = [];
    
    for (let i = 0; i < parts.length; i++) {
      const current = parts[i];
      const next = parts[i + 1];
      
      // 如果当前是数字，下一个是文本，尝试组合为单位
      if (current.type === 'number' && next && next.type === 'text') {
        const potentialUnit = next.value;
        const unitInfo = this.unitRecognizer.getUnitInfo(potentialUnit);
        
        // 如果文本看起来像单位，则合并
        if (unitInfo.category !== 'unknown' || potentialUnit.length <= 3) {
          enhanced.push({
            type: 'unit',
            value: current.value,
            unit: potentialUnit,
            unitInfo: unitInfo,
            fullMatch: current.value + potentialUnit,
            enhanced: true // 标记为增强处理的结果
          });
          i++; // 跳过下一个元素
          continue;
        }
      }
      
      enhanced.push(current);
    }
    
    return enhanced;
  }
}

// 根据单位获取unit_id
function getUnitId(unitName, unitOptions) {
  const option = unitOptions.find(opt => opt.label === unitName);
  return option ? option.value : null;
}

// 判断解析部分是否匹配value_module
function matchesValueModule(part, module) {
  if (part.type === 'text') {
    return module.input_type === 'input' && 
           (module.extra?.unit_rule_type === '无需上下限' || !module.unit_options?.length);
  } else if (part.type === 'unit') {
    return module.input_type === 'input' && 
           module.unit_options?.some(opt => opt.label === part.unit);
  }
  return false;
}

// 计算模板匹配度
function calculateTemplateMatch(parsedParts, template) {
  const modules = template.value_modules;
  let score = 0;
  let matchedModules = 0;
  
  // 尝试匹配解析部分与模块
  let partIndex = 0;
  for (let i = 0; i < modules.length && partIndex < parsedParts.length; i++) {
    const module = modules[i];
    const part = parsedParts[partIndex];
    
    if (matchesValueModule(part, module)) {
      score += 10;
      matchedModules++;
      partIndex++;
    }
  }
  
  // 额外奖励：如果所有解析部分都匹配了
  if (partIndex === parsedParts.length) {
    score += 20;
  }
  
  // 额外奖励：如果匹配的模块数量合理
  if (matchedModules === parsedParts.length && matchedModules === modules.length) {
    score += 30;
  }
  
  return { score, matchedModules };
}

// 找到最佳匹配的模板
function findBestTemplate(specName, measureTemplates) {
  const parsedParts = parseSpecName(specName);
  let bestMatch = null;
  let bestScore = 0;
  
  measureTemplates.forEach(template => {
    const match = calculateTemplateMatch(parsedParts, template);
    if (match.score > bestScore) {
      bestScore = match.score;
      bestMatch = { template, parsedParts, ...match };
    }
  });
  
  return bestMatch;
}

// 构建measureInfo
function buildMeasureInfo(template, parsedParts) {
  const values = [];
  const modules = template.value_modules;
  
  let partIndex = 0;
  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];
    const part = parsedParts[partIndex];
    
    const value = {
      module_id: module.module_id,
      prefix: module.prefix || "",
      suffix: module.suffix || ""
    };
    
    if (part && matchesValueModule(part, module)) {
      if (part.type === 'text') {
        value.value = part.rawValue;
      } else if (part.type === 'unit') {
        value.value = part.value;
        const unitId = getUnitId(part.unit, module.unit_options || []);
        if (unitId) {
          value.unit_id = unitId;
          value.unit_name = part.unit;
        }
      }
      partIndex++;
    } else {
      // 设置默认值
      if (module.unit_options?.length > 0) {
        const defaultUnit = module.unit_options[0];
        value.value = "1";
        value.unit_id = defaultUnit.value;
        value.unit_name = defaultUnit.label;
      } else {
        value.value = "默认值";
      }
    }
    
    values.push(value);
  }
  
  return {
    template_id: template.template_id,
    values
  };
}

// 构建spec_price_unit_info
function buildSpecPriceUnitInfo(measureInfo, parsedParts) {
  const result = [];
  
  // 如果有measureInfo，使用模板化的方式
  if (measureInfo && measureInfo.values && measureInfo.values.length > 0) {
    measureInfo.values.forEach(value => {
      if (value.suffix === '*' && value.unit_name) {
        // 重量单位，通常用于总净含量计算
        const weightValue = parseFloat(value.value) || 0;
        const quantityValue = measureInfo.values.find(v => 
          v.unit_name && ['瓶', '袋', '包', '盒', '个', '件'].includes(v.unit_name)
        );
        
        if (quantityValue) {
          const quantity = parseFloat(quantityValue.value) || 1;
          const totalWeight = weightValue * quantity;
          
          result.push({
            correction_type: 0,
            is_updated: false,
            property_name: "件数",
            value_name: quantityValue.value + quantityValue.unit_name
          });
          
          result.push({
            correction_type: 0,
            is_updated: false,
            property_name: "总净含量",
            value_name: totalWeight + value.unit_name
          });
        }
      } else if (value.prefix === "总净含量：") {
        result.push({
          correction_type: 0,
          is_updated: false,
          property_name: "总净含量",
          value_name: value.value + (value.unit_name || "")
        });
      }
    });
  } 
  
  // 如果measureInfo没有生成有效结果，使用解析结果直接构建
  if (result.length === 0 && parsedParts) {
    const weightParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'weight');
    const packageParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'package');
    
    let totalWeight = 0;
    let packageCount = 1;
    let weightUnit = 'g';
    let packageUnit = '个';
    
    // 计算总重量和件数
    if (weightParts.length > 0 && packageParts.length > 0) {
      const weight = parseFloat(weightParts[0].value) || 0;
      packageCount = parseFloat(packageParts[0].value) || 1;
      weightUnit = weightParts[0].unit;
      packageUnit = packageParts[0].unit;
      totalWeight = weight * packageCount;
      
      result.push({
        correction_type: 0,
        is_updated: false,
        property_name: "件数",
        value_name: packageCount + packageUnit
      });
      
      result.push({
        correction_type: 0,
        is_updated: false,
        property_name: "总净含量",
        value_name: totalWeight + weightUnit
      });
    } else if (weightParts.length > 0) {
      // 只有重量信息
      const weight = parseFloat(weightParts[0].value) || 0;
      weightUnit = weightParts[0].unit;
      
      result.push({
        correction_type: 0,
        is_updated: false,
        property_name: "件数",
        value_name: "1个"
      });
      
      result.push({
        correction_type: 0,
        is_updated: false,
        property_name: "总净含量",
        value_name: weight + weightUnit
      });
    } else if (packageParts.length > 0) {
      // 只有包装信息
      packageCount = parseFloat(packageParts[0].value) || 1;
      packageUnit = packageParts[0].unit;
      
      result.push({
        correction_type: 0,
        is_updated: false,
        property_name: "件数",
        value_name: packageCount + packageUnit
      });
    }
  }
  
  // 如果仍然没有结果，提供默认值
  if (result.length === 0) {
    result.push({
      correction_type: 0,
      is_updated: false,
      property_name: "件数",
      value_name: "1个"
    });
  }
  
  return result;
}

// 创建默认的measureInfo（当没有模板时使用）
function createDefaultMeasureInfo(parsedParts, specName) {
  const values = [];
  
  // 为文本部分创建值
  const textParts = parsedParts.filter(p => p.type === 'text');
  if (textParts.length > 0) {
    values.push({
      module_id: 1000, // 使用虚拟ID
      prefix: "",
      suffix: "",
      value: textParts[0].rawValue
    });
  }
  
  // 为重量单位创建值
  const weightParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'weight');
  if (weightParts.length > 0) {
    const weightPart = weightParts[0];
    values.push({
      module_id: 1001,
      prefix: "",
      suffix: "*",
      value: weightPart.value,
      unit_id: weightPart.unitInfo.id,
      unit_name: weightPart.unit
    });
  }
  
  // 为包装单位创建值
  const packageParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'package');
  if (packageParts.length > 0) {
    const packagePart = packageParts[0];
    values.push({
      module_id: 1002,
      prefix: "",
      suffix: "",
      value: packagePart.value,
      unit_id: packagePart.unitInfo.id,
      unit_name: packagePart.unit
    });
  }
  
  // 如果没有任何解析结果，使用原始规格名称
  if (values.length === 0) {
    values.push({
      module_id: 1000,
      prefix: "",
      suffix: "",
      value: specName
    });
  }
  
  return {
    template_id: 0, // 表示无模板
    values
  };
}

// 增强的SKU模板推断器类
class SKUTemplateInferrer {
  constructor(skuOptions) {
    this.skuOptions = skuOptions;
    this.measureTemplates = skuOptions?.[0]?.additions?.measure_templates || [];
    this.hasTemplates = this.measureTemplates.length > 0;
    
    // 初始化动态单位识别器和解析器
    this.unitRecognizer = new UnitRecognizer(skuOptions);
    this.specParser = new SpecParser(this.unitRecognizer);
  }
  
  // 推断最佳模板和measureInfo
  inferMeasureInfo(specName) {
    // 使用新的解析器
    let parsedParts = this.specParser.parseSpecName(specName);
    parsedParts = this.specParser.enhanceParsedParts(parsedParts);
    
    if (this.hasTemplates) {
      // 有模板时使用模板匹配
      const bestMatch = this.findBestTemplateMatch(specName, parsedParts, this.measureTemplates);
      if (bestMatch && bestMatch.score > 0) {
        return {
          measureInfo: this.buildMeasureInfoFromTemplate(bestMatch.template, parsedParts),
          parsedParts,
          templateUsed: true,
          matchScore: bestMatch.score
        };
      }
      
      // 模板匹配失败，回退到默认模板
      const defaultTemplate = this.measureTemplates.find(t => t.template_id === 98) || this.measureTemplates[0];
      if (defaultTemplate) {
        return {
          measureInfo: this.buildMeasureInfoFromTemplate(defaultTemplate, parsedParts),
          parsedParts,
          templateUsed: true,
          matchScore: 0
        };
      }
    }
    
    // 无模板或模板失败时，使用直接推断
    return {
      measureInfo: this.createAdaptiveMeasureInfo(parsedParts, specName),
      parsedParts,
      templateUsed: false,
      matchScore: 0
    };
  }
  
  // 增强的模板匹配算法
  findBestTemplateMatch(specName, parsedParts, templates) {
    let bestMatch = null;
    let bestScore = 0;
    
    templates.forEach(template => {
      const score = this.calculateTemplateMatchScore(parsedParts, template);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { template, score };
      }
    });
    
    return bestMatch;
  }
  
  // 计算模板匹配分数
  calculateTemplateMatchScore(parsedParts, template) {
    const modules = template.value_modules || [];
    let score = 0;
    let matchedParts = 0;
    
    // 基础匹配：解析部分数量与模块数量的匹配度
    const partsCount = parsedParts.length;
    const modulesCount = modules.length;
    
    if (partsCount === modulesCount) {
      score += 30; // 数量完全匹配奖励
    } else if (Math.abs(partsCount - modulesCount) <= 1) {
      score += 15; // 数量接近匹配奖励
    }
    
    // 详细匹配：检查每个部分是否能匹配到合适的模块
    parsedParts.forEach(part => {
      const matchingModule = this.findMatchingModule(part, modules);
      if (matchingModule) {
        score += 20;
        matchedParts++;
        
        // 额外奖励：单位匹配度
        if (part.type === 'unit' && matchingModule.unit_options) {
          const hasMatchingUnit = matchingModule.unit_options.some(opt => opt.label === part.unit);
          if (hasMatchingUnit) {
            score += 10;
          }
        }
      }
    });
    
    // 匹配完成度奖励
    const matchRatio = matchedParts / Math.max(partsCount, 1);
    score += matchRatio * 20;
    
    return score;
  }
  
  // 找到与解析部分匹配的模块
  findMatchingModule(part, modules) {
    return modules.find(module => {
      if (part.type === 'text') {
        return module.input_type === 'input' && 
               (module.extra?.unit_rule_type === '无需上下限' || !module.unit_options?.length);
      } else if (part.type === 'unit') {
        return module.input_type === 'input' && 
               module.unit_options?.some(opt => opt.label === part.unit);
      } else if (part.type === 'number') {
        return module.input_type === 'input' && module.unit_options?.length > 0;
      }
      return false;
    });
  }
  
  // 从模板构建measureInfo
  buildMeasureInfoFromTemplate(template, parsedParts) {
    const values = [];
    const modules = template.value_modules || [];
    
    let partIndex = 0;
    modules.forEach((module, moduleIndex) => {
      const value = {
        module_id: module.module_id,
        prefix: module.prefix || "",
        suffix: module.suffix || ""
      };
      
      // 尝试匹配解析部分
      const matchingPart = this.findBestPartForModule(parsedParts, module, partIndex);
      
      if (matchingPart) {
        if (matchingPart.type === 'text') {
          value.value = matchingPart.rawValue || matchingPart.value;
        } else if (matchingPart.type === 'unit') {
          value.value = matchingPart.value;
          const unitInfo = this.unitRecognizer.getUnitInfo(matchingPart.unit);
          value.unit_id = unitInfo.id;
          value.unit_name = matchingPart.unit;
        } else if (matchingPart.type === 'number' && module.unit_options?.length > 0) {
          value.value = matchingPart.value;
          const defaultUnit = module.unit_options[0];
          value.unit_id = defaultUnit.value;
          value.unit_name = defaultUnit.label;
        }
        partIndex++;
      } else {
        // 设置默认值
        if (module.unit_options?.length > 0) {
          const defaultUnit = module.unit_options[0];
          value.value = "1";
          value.unit_id = defaultUnit.value;
          value.unit_name = defaultUnit.label;
        } else {
          value.value = "默认值";
        }
      }
      
      values.push(value);
    });
    
    return {
      template_id: template.template_id,
      values
    };
  }
  
  // 为模块找到最佳匹配的解析部分
  findBestPartForModule(parsedParts, module, startIndex = 0) {
    for (let i = startIndex; i < parsedParts.length; i++) {
      const part = parsedParts[i];
      if (this.isPartCompatibleWithModule(part, module)) {
        parsedParts.splice(i, 1); // 移除已使用的部分
        return part;
      }
    }
    return null;
  }
  
  // 检查解析部分是否与模块兼容
  isPartCompatibleWithModule(part, module) {
    if (part.type === 'text') {
      return module.extra?.unit_rule_type === '无需上下限' || !module.unit_options?.length;
    } else if (part.type === 'unit') {
      return module.unit_options?.some(opt => opt.label === part.unit);
    } else if (part.type === 'number') {
      return module.unit_options?.length > 0;
    }
    return false;
  }
  
  // 创建自适应的measureInfo（无模板时使用）
  createAdaptiveMeasureInfo(parsedParts, specName) {
    const values = [];
    let moduleIdCounter = 1000;
    
    parsedParts.forEach(part => {
      const value = {
        module_id: moduleIdCounter++,
        prefix: "",
        suffix: ""
      };
      
      if (part.type === 'text') {
        value.value = part.rawValue || part.value;
      } else if (part.type === 'unit') {
        value.value = part.value;
        value.unit_id = part.unitInfo.id;
        value.unit_name = part.unit;
        // 根据单位类别设置suffix
        if (part.unitInfo.category === 'weight' || part.unitInfo.category === 'volume') {
          value.suffix = "*";
        }
      } else if (part.type === 'number') {
        value.value = part.value;
      }
      
      values.push(value);
    });
    
    // 如果没有任何有效解析结果，使用原始规格名称
    if (values.length === 0) {
      values.push({
        module_id: 1000,
        prefix: "",
        suffix: "",
        value: specName
      });
    }
    
    return {
      template_id: 0, // 表示自适应模板
      values
    };
  }
  
  // 构建spec_price_unit_info
  buildPriceUnitInfo(measureInfo, parsedParts) {
    return buildSpecPriceUnitInfo(measureInfo, parsedParts);
  }
}

function parseTToSku(goodsInfo, skuOptions) {
  const cpId = skuOptions?.[0]?.additions?.cp_id || 3164;
  
  const specs = goodsInfo?.specs || [];
  const skusMap = goodsInfo?.skus || {};
  
  if (specs.length === 0) {
    return {
      sku_detail: { value: [] },
      spec_detail: { value: [] }
    };
  }

  // 创建模板推断器
  const inferrer = new SKUTemplateInferrer(skuOptions);
  
  // 处理每个规格类型，生成spec_detail数组
  const specDetails = [];
  const allSpecValues = new Map(); // 存储所有规格值，用于后续SKU组合
  
  specs.forEach(spec => {
    const specName = spec.name;
    const specItems = spec.spec_items || [];
    
    if (specItems.length === 0) return;
    
    // 为每个规格类型找到最佳匹配的skuOption ID
    const bestSpecDetailId = findBestMatchingSpecDetailId(skuOptions, spec, inferrer);
    
    const specValues = [];
    
    specItems.forEach(item => {
      const specValueId = item.id;
      const itemName = item.name;
      
      // 使用推断器获取measureInfo
      const inferResult = inferrer.inferMeasureInfo(itemName);
      const { measureInfo } = inferResult;
      
      const specValue = {
        id: specValueId,
        name: itemName,
        measure_info: measureInfo,
        invalid: false,
        img_url: ""
      };
      
      specValues.push(specValue);
      
      // 存储规格值信息，用于后续SKU组合
      allSpecValues.set(specValueId, {
        specName,
        itemName,
        measureInfo,
        inferResult
      });
    });
    
    // 创建spec_detail条目
    specDetails.push({
      cp_id: cpId,
      id: bestSpecDetailId,
      name: specName,
      spec_values: specValues
    });
  });
  
  // 根据skusMap生成sku_detail数组
  const skuDetails = [];
  
  Object.entries(skusMap).forEach(([skuKey, skuInfo]) => {
    if (!skuInfo.can_select) return; // 跳过不可选择的SKU
    
    // 解析SKU key，获取规格ID组合
    const specDetailIds = skuKey.split('_');
    
    // 构建spec_price_unit_info，基于所有相关规格
    const specPriceUnitInfo = buildCombinedPriceUnitInfo(specDetailIds, allSpecValues, inferrer);
    
    const skuDetail = {
      id: generateRandomId(),
      stock_info: {
        stock_num: 0
      },
      sku_status: true,
      confirm_no_barcode: false,
      spec_detail_ids: specDetailIds,
      spec_price_unit_info: specPriceUnitInfo,
      price: "0"
    };
    
    skuDetails.push(skuDetail);
  });
  
  return {
    sku_detail: {
      value: skuDetails
    },
    spec_detail: {
      value: specDetails
    }
  };
}

// 为规格类型找到最佳匹配的skuOption ID
function findBestMatchingSpecDetailId(skuOptions, spec, inferrer) {
  if (!skuOptions || skuOptions.length === 0) {
    return spec.name === '套餐类型' ? '10000' : generateSpecDetailId(spec.name);
  }
  
  let bestMatch = null;
  let bestScore = -1;
  
  spec.spec_items.forEach(item => {
    const inferResult = inferrer.inferMeasureInfo(item.name);
    const { templateUsed, matchScore, measureInfo } = inferResult;
    
    if (matchScore > bestScore) {
      bestScore = matchScore;
      
      // 如果使用了模板，尝试找到对应的skuOption
      if (templateUsed && measureInfo && measureInfo.template_id) {
        const matchingOption = skuOptions.find(option => {
          const templates = option?.additions?.measure_templates || [];
          return templates.some(template => template.template_id === measureInfo.template_id);
        });
        
        if (matchingOption) {
          bestMatch = matchingOption.id;
        }
      }
    }
  });
  
  return bestMatch || skuOptions[0]?.id || generateSpecDetailId(spec.name);
}

// 生成基于规格名称的ID
function generateSpecDetailId(specName) {
  const hash = specName.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
  }, 0);
  return Math.abs(hash).toString();
}

// 构建组合规格的价格单位信息
function buildCombinedPriceUnitInfo(specDetailIds, allSpecValues, inferrer) {
  const combinedInfo = [];
  
  // 分析所有相关规格值
  const relatedSpecs = specDetailIds.map(id => allSpecValues.get(id)).filter(Boolean);
  
  if (relatedSpecs.length === 0) {
    return [{
      correction_type: 0,
      is_updated: false,
      property_name: "件数",
      value_name: "1个"
    }];
  }
  
  // 尝试从组合规格中提取有意义的信息
  let quantity = 1;
  let quantityUnit = '个';
  let weight = 0;
  let weightUnit = 'g';
  
  relatedSpecs.forEach(spec => {
    const { measureInfo, inferResult } = spec;
    const { parsedParts } = inferResult;
    
    // 从解析结果中提取数量和重量信息
    if (parsedParts) {
      const weightParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'weight');
      const packageParts = parsedParts.filter(p => p.type === 'unit' && p.unitInfo?.category === 'package');
      const numberParts = parsedParts.filter(p => p.type === 'number');
      
      // 提取重量信息
      if (weightParts.length > 0) {
        const weightPart = weightParts[0];
        weight = Math.max(weight, parseFloat(weightPart.value) || 0);
        weightUnit = weightPart.unit;
      }
      
      // 提取数量信息
      if (packageParts.length > 0) {
        const packagePart = packageParts[0];
        quantity = Math.max(quantity, parseFloat(packagePart.value) || 1);
        quantityUnit = packagePart.unit;
      } else if (numberParts.length > 0 && !weightParts.length) {
        // 如果没有包装单位但有纯数字，可能是数量
        const numberPart = numberParts[0];
        const num = parseFloat(numberPart.value) || 1;
        if (num > quantity) {
          quantity = num;
        }
      }
    }
  });
  
  // 构建最终的价格单位信息
  combinedInfo.push({
    correction_type: 0,
    is_updated: false,
    property_name: "件数",
    value_name: quantity + quantityUnit
  });
  
  if (weight > 0) {
    const totalWeight = weight * quantity;
    combinedInfo.push({
      correction_type: 0,
      is_updated: false,
      property_name: "总净含量",
      value_name: totalWeight + weightUnit
    });
  }
  
  return combinedInfo;
}

// 找到最匹配的 skuOption ID
function findBestMatchingSkuOptionId(skuOptions, inferResult, specName) {
  if (!skuOptions || skuOptions.length === 0) return null;
  
  const { templateUsed, matchScore, measureInfo } = inferResult;
  
  // 如果使用了模板，尝试找到对应的skuOption
  if (templateUsed && measureInfo && measureInfo.template_id) {
    const matchingOption = skuOptions.find(option => {
      const templates = option?.additions?.measure_templates || [];
      return templates.some(template => template.template_id === measureInfo.template_id);
    });
    
    if (matchingOption) {
      return matchingOption.id;
    }
  }
  
  // 如果没有找到模板匹配，使用第一个可用的skuOption
  const firstOption = skuOptions[0];
  return firstOption?.id || null;
}

// 使用示例
// const result = parseTToSku(goodsInfo, skuOptions);
// console.log(JSON.stringify(result, null, 2));

module.exports = { parseTToSku };