/**
 * Module for page content handling.
 */
((function (global, factory) {
  global = typeof globalThis !== "undefined" ? globalThis : global || self;
  global.page = factory(global);
})(this, function (global) {
  'use strict';

  class PlanBase {
    static fields;
    static check() { throw new Error(`not implemented`); }
    static copy() { throw new Error(`not implemented`); }
    static paste() { throw new Error(`not implemented`); }
  }

  class PlanGeneral extends PlanBase {
    static check(document) {
      return !!document.querySelector('#cph_cboPlan_txt');
    }

    static copy(document, data, {skipAccessDate = false} = {}) {
      data.id = document.querySelector('#cph_txtID').value;
      data.birth = document.querySelector('#cph_txtBirth_txt').value;
      data.name = document.querySelector('#cph_txtName').value;
      if (!data.id) {
        throw new Error(`缺少基本資料: 身分證號`);
      }
      if (!data.birth) {
        throw new Error(`缺少基本資料: 出生日期`);
      }

      if (!skipAccessDate) {
        data.date = document.querySelector('#cph_txtASSESS_DATE_txt').value;
        if (!data.date) {
          throw new Error(`缺少基本資料: 評量日期`);
        }
      }
    }

    static copyFromFrame(document, data) {
      const frame = document.querySelector('iframe.fancybox-iframe');
      if (!frame) {
        return;
      }

      const form = frame.contentDocument.querySelector('form');
      const scaleType = scaleTypeMap._determine(form);
      const handler = scaleTypeMap[scaleType];
      if (typeof handler?.copyFrame !== 'function') {
        return;
      }

      console.debug('Copying from frame (type: "%s")...', scaleType);
      handler.copyFrame(form, data);
    }

    /**
     * @returns {Promise<boolean|undefined>} true to skip
     */
    static async paste(document, result, {forceDate} = {}) {
      const id = result.id = document.querySelector('#cph_txtID').value;
      const birth = document.querySelector('#cph_txtBirth_txt').value;
      if (!id) {
        throw new Error(`缺少基本資料: 身分證號`);
      }
      if (!birth) {
        throw new Error(`缺少基本資料: 出生日期`);
      }

      const data = result.data = (await chrome.storage.session.get(id))[id];
      if (!data) {
        throw new Error(`個案 ${id} 沒有已暫存的數據`);
      }

      if (forceDate) {
        for (const date in data.infos) {
          if (date !== forceDate) {
            delete data.infos[date];
          }
        }
      }

      this._pasteToFrame(document, result);
      if (result.hasFrame) { return true; }

      result.infos = getFilteredInfos(data, this.fields);
      if (result.infos.length !== 1) { return true; }
    }

    static _pasteToFrame(document, result) {
      const frame = document.querySelector('iframe.fancybox-iframe');
      if (!frame) {
        return;
      }

      const form = frame.contentDocument.querySelector('form');
      const scaleType = scaleTypeMap._determine(form);
      if (!scaleType) {
        throw new Error(`無法辨識彈出對話框的量表類型`);
      }

      result.hasFrame = true;

      console.debug('Pasting to frame (type: "%s")...', scaleType);
      scaleTypeMap[scaleType].pasteFrame(form, result);
    }
  }

  class PlanHosp extends PlanGeneral {
    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "01";
    }

    static copy(document, data, {skipBarthal = false, ...options} = {}) {
      super.copy(document, data, options);

      if (!skipBarthal) {
        const prefix = 'cph_btnBarthel_hidBLI_';
        const cut = prefix.length;
        data.info.barthal = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.barthal[elem.id.slice(cut)] = elem.value;
        }
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {barthal}}] = result.infos;
      if (barthal) {
        const prefix = 'cph_btnBarthel_hidBLI_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = barthal[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanHospCva extends PlanHosp {
    static fields = ['barthal', 'nihss'];

    static check(document) {
      return super.check(document) && document.querySelector('#cph_cboCareType_0')?.checked;
    }

    static copy(document, data, options) {
      super.copy(document, data, options);
      const prefix = 'cph_btnNIHSS_hidBLI_SCALE';
      const cut = prefix.length;
      data.info.nihss = {};
      for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
        data.info.nihss[elem.id.slice(cut)] = elem.value;
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {nihss}}] = result.infos;
      if (nihss) {
        const prefix = 'cph_btnNIHSS_hidBLI_SCALE';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = nihss[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanHospIci extends PlanHosp {
    static fields = ['barthal', 'rts'];

    static check(document) {
      return super.check(document) && document.querySelector('#cph_cboCareType_1')?.checked;
    }

    static copy(document, data, options) {
      super.copy(document, data, options);
      const prefix = 'cph_btnRTS_hidBLI_SCALE2_';
      const cut = prefix.length;
      data.info.rts = {};
      for (const elem of document.querySelectorAll(`input[id^="${prefix}"]:not([id^="${prefix}CGS"])`)) {
        data.info.rts[elem.id.slice(cut)] = elem.value;
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {rts}}] = result.infos;
      if (rts) {
        const prefix = 'cph_btnRTS_hidBLI_SCALE2_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]:not([id^="${prefix}CGS"])`)) {
          elem.value = rts[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanHospSci extends PlanHosp {
    static fields = ['barthal', 'asia'];

    static check(document) {
      return super.check(document) && document.querySelector('#cph_cboCareType_2')?.checked;
    }

    static copy(document, data, options) {
      super.copy(document, data, options);
      const prefix = 'cph_btnASAI_hid';
      const cut = prefix.length;
      data.info.asia = {};
      for (const elem of document.querySelectorAll(`input[id^=${prefix}]`)) {
        data.info.asia[elem.id.slice(cut)] = elem.value;
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {asia}}] = result.infos;
      if (asia) {
        const prefix = 'cph_btnASAI_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^=${prefix}]`)) {
          elem.value = asia[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanHospDyspnea extends PlanHosp {
    static fields = ['plan_hosp_dyspnea', 'barthal', 'act', 'cat', 'mmrc'];

    static check(document) {
      return super.check(document) && document.querySelector('#cph_cboCareType_3')?.checked;
    }

    static copy(document, data, options) {
      super.copy(document, data, options);

      {
        data.info.plan_hosp_dyspnea = {
          RR: document.querySelector('#cph_txtRR').value,
          HR: document.querySelector('#cph_txtHR').value,
          SpO2: document.querySelector('#cph_txtSpO2').value,
        };
      }

      {
        const prefix = 'cph_btnACT_hidACT_';
        const cut = prefix.length;
        data.info.act = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.act[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        const prefix = 'cph_btnCAT_hidCAT_';
        const cut = prefix.length;
        data.info.cat = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.cat[elem.id.slice(cut)] = elem.value;
        }
      }

      data.info.mmrc = document.querySelector('#cph_cboMMRC_txt').value;
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {plan_hosp_dyspnea, act, cat, mmrc}}] = result.infos;

      if (plan_hosp_dyspnea) {
        const {RR, HR, SpO2} = plan_hosp_dyspnea;
        document.querySelector('#cph_txtRR').value = RR;
        document.querySelector('#cph_txtHR').value = HR;
        document.querySelector('#cph_txtSpO2').value = SpO2;
      }

      if (act) {
        const prefix = 'cph_btnACT_hidACT_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = act[elem.id.slice(cut)];
        }
      }

      if (cat) {
        const prefix = 'cph_btnCAT_hidCAT_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = cat[elem.id.slice(cut)];
        }
      }

      if (mmrc !== undefined) {
        document.querySelector('#cph_cboMMRC_txt').value = mmrc;
      }
    }
  }

  class PlanHospPop extends PlanHosp {
    static fields = ['vas', 'mcgill', 'odi'];

    static check(document) {
      return super.check(document) && document.querySelector('#cph_cboCareType_4')?.checked;
    }

    static copy(document, data, options) {
      super.copy(document, data, {...options, skipBarthal: true});

      data.info.vas = document.querySelector('#cph_btnVAS_hid_VAS').value;

      {
        const prefix = 'cph_btnMcGill_hidMcGill_';
        const cut = prefix.length;
        data.info.mcgill = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.mcgill[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        const prefix = 'cph_btnODI_hidODI_';
        const cut = prefix.length;
        data.info.odi = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.odi[elem.id.slice(cut)] = elem.value;
        }
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {vas, mcgill, odi}}] = result.infos;

      if (vas !== undefined) {
        document.querySelector('#cph_btnVAS_hid_VAS').value = vas;
      }

      if (mcgill) {
        const prefix = 'cph_btnMcGill_hidMcGill_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = mcgill[elem.id.slice(cut)];
        }
      }

      if (odi) {
        const prefix = 'cph_btnODI_hidODI_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = odi[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanCa extends PlanGeneral {
    static fields = ['factg', 'ecog'];

    static copy(document, data, options) {
      super.copy(document, data, options);

      {
        const prefix = 'cph_btnFACTG_hid';
        const cut = prefix.length;
        data.info.factg = {};
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]:not([id^="${prefix}FACT_"])`)) {
          data.info.factg[elem.id.slice(cut)] = elem.value;
        }
      }

      data.info.ecog = document.querySelector('#cph_txtECOG').value;
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {factg, ecog}}] = result.infos;

      if (factg) {
        const prefix = 'cph_btnFACTG_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]:not([id^="${prefix}FACT_"])`)) {
          elem.value = factg[elem.id.slice(cut)];
        }
      }

      if (ecog !== undefined) {
        document.querySelector('#cph_txtECOG').value = ecog;
      }
    }
  }

  class PlanCaHosp extends PlanCa {
    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "02";
    }
  }

  class PlanCaOpd extends PlanCa {
    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "03";
    }
  }

  class PlanAr extends PlanGeneral {
    static fields = ['rcat'];

    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "04";
    }

    static copy(document, data, options) {
      super.copy(document, data, options);

      const prefix = 'cph_btnRCAT_h_RCAT_SCORE';
      const cut = prefix.length;
      data.info.rcat = {};
      for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
        data.info.rcat[elem.id.slice(cut)] = elem.value;
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {rcat}}] = result.infos;
      if (rcat) {
        const prefix = 'cph_btnRCAT_h_RCAT_SCORE';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = rcat[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanCaExt extends PlanGeneral {
    static fields = ['ctcae', 'bfit', 'whoqol'];

    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "05";
    }

    static copy(document, data, options) {
      super.copy(document, data, {...options, skipAccessDate: true});

      data.date = document.querySelector('#cph_txtCASE_DATE_txt').value;
      if (!data.date) {
        throw new Error(`缺少基本資料: 收案日期`);
      }

      {
        data.info.ctcae = {};
        const prefix = 'cph_btnCTCAE_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}BEFORE"], input[id^="${prefix}AFTER"], input[id^="${prefix}Txt"]`)) {
          data.info.ctcae[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        data.info.bfit = {};
        const prefix = 'cph_btnBFIT_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll([
          `#${prefix}TireBefore`,
          `input[id^="${prefix}Before"]:not([id^="${prefix}BeforeTotal"])`,
          `#${prefix}TireAfter`,
          `input[id^="${prefix}After"]:not([id^="${prefix}AfterTotal"])`,
        ].join(','))) {
          data.info.bfit[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        data.info.whoqol = {};
        const prefix = 'cph_btnAssWHOQOLBREF_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}BEFORE"], input[id^="${prefix}AFTER"]`)) {
          data.info.whoqol[elem.id.slice(cut)] = elem.value;
        }
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {ctcae, bfit, whoqol}}] = result.infos;
      if (ctcae) {
        const prefix = 'cph_btnCTCAE_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}BEFORE"], input[id^="${prefix}AFTER"], input[id^="${prefix}Txt"]`)) {
          elem.value = ctcae[elem.id.slice(cut)];
        }
      }

      if (bfit) {
        const prefix = 'cph_btnBFIT_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll([
          `#${prefix}TireBefore`,
          `input[id^="${prefix}Before"]:not([id^="${prefix}BeforeTotal"])`,
          `#${prefix}TireAfter`,
          `input[id^="${prefix}After"]:not([id^="${prefix}AfterTotal"])`,
        ].join(','))) {
          elem.value = bfit[elem.id.slice(cut)];
        }
      }

      if (whoqol) {
        const prefix = 'cph_btnAssWHOQOLBREF_hid';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}BEFORE"], input[id^="${prefix}AFTER"]`)) {
          elem.value = whoqol[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanCkd extends PlanGeneral {
    static fields = ['plan_ckd', 'eq5d', 'ckd2', 'ckd3', 'ckd4'];

    static check(document) {
      return document.querySelector('#cph_cboPlan_txt')?.value === "06";
    }

    static copy(document, data, options) {
      super.copy(document, data, options);

      {
        data.info.plan_ckd = {};
        for (const elem of document.querySelectorAll('#cph_pnlBaseData input[id^=cph_txt]')) {
          const key = elem.id.slice(7);
          data.info.plan_ckd[key] = elem.value;
        }
        data.info.plan_ckd.SRC = document.querySelector('#cph_cboCHK_SRC_txt').value;
        data.info.plan_ckd.DM = getRadioValue(document.querySelector('#cph_chkDM_Y'));
      }

      {
        data.info.eq5d = {};
        const prefix = 'cph_btnEQ5D_hidEQ_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.eq5d[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        data.info.ckd2 = {};
        const prefix = 'cph_hidS02_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.ckd2[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        data.info.ckd3 = {};
        const prefix = 'cph_hidS03_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.ckd3[elem.id.slice(cut)] = elem.value;
        }
      }

      {
        data.info.ckd4 = {};
        const prefix = 'cph_hidS04_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.ckd4[elem.id.slice(cut)] = elem.value;
        }
      }
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {plan_ckd, eq5d, ckd2, ckd3, ckd4}}] = result.infos;

      if (plan_ckd) {
        const {DM, SRC, ...keys} = plan_ckd;
        for (const elem of document.querySelectorAll('#cph_pnlBaseData input[id^=cph_txt]')) {
          const key = elem.id.slice(7);
          applyValue(elem, keys[key]);
        }

        applyValue(document.querySelector('#cph_cboCHK_SRC_txt'), SRC);

        applyRadioValue(document.querySelector('#cph_chkDM_Y'), DM);
      }

      if (eq5d) {
        const prefix = 'cph_btnEQ5D_hidEQ_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = eq5d[elem.id.slice(cut)];
        }
      }

      if (ckd2) {
        const prefix = 'cph_hidS02_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = ckd2[elem.id.slice(cut)];
        }
      }

      if (ckd3) {
        const prefix = 'cph_hidS03_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = ckd3[elem.id.slice(cut)];
        }
      }

      if (ckd4) {
        const prefix = 'cph_hidS04_';
        const cut = prefix.length;
        for (const elem of document.querySelectorAll(`input[id^="${prefix}"]`)) {
          elem.value = ckd4[elem.id.slice(cut)];
        }
      }
    }
  }

  class PlanSpecial extends PlanBase {
    static check(document) {
      return !!document.querySelector('#cph_cboDisCode_txt');
    }

    static copy(document, data, options) {
      data.id = document.querySelector('#cph_txtID').value;
      data.birth = document.querySelector('#cph_txtBirthTime_txt').value;
      data.name = document.querySelector('#cph_lblName').textContent;
      if (!data.id) {
        throw new Error(`缺少基本資料: 身分證號`);
      }
      if (!data.birth) {
        throw new Error(`缺少基本資料: 出生日期`);
      }

      data.date = document.querySelector('#cph_txtCaseTime_txt').value;
      if (!data.date) {
        throw new Error(`缺少基本資料: 就醫日期`);
      }
    }

    static async paste(document, result, {forceDate} = {}) {
      const id = result.id = document.querySelector('#cph_txtID').value;
      const birth = document.querySelector('#cph_txtBirthTime_txt').value;
      if (!id) {
        throw new Error(`缺少基本資料: 身分證號`);
      }
      if (!birth) {
        throw new Error(`缺少基本資料: 出生日期`);
      }

      const data = result.data = (await chrome.storage.session.get(id))[id];
      if (!data) {
        throw new Error(`個案 ${id} 沒有已暫存的數據`);
      }

      if (forceDate) {
        for (const date in data.infos) {
          if (date !== forceDate) {
            delete data.infos[date];
          }
        }
      }

      result.infos = getFilteredInfos(data, this.fields);
      if (result.infos.length !== 1) { return true; }
    }
  }

  // @TODO
  // eslint-disable-next-line no-unused-vars
  class PlanSpecialAsthma extends PlanSpecial {
    static check(document) {
      return document.querySelector('#cph_cboDisCode_txt')?.value === '01';
    }
  }

  // @TODO
  // eslint-disable-next-line no-unused-vars
  class PlanSpecialCp extends PlanSpecial {
    static check(document) {
      return document.querySelector('#cph_cboDisCode_txt')?.value === '02';
    }
  }

  class PlanSpecialCva extends PlanSpecial {
    static fields = ['barthal'];

    static _mapKeyId = {
      '1': 'cph_txtEatEvalu',
      '10': 'cph_txtMoveEvalu',
      '2': 'cph_txtPersonalEvalu',
      '3': 'cph_txtToiletEvalu',
      '4': 'cph_txtShowerEvalu',
      '8': 'cph_txtWalkEvalu',
      '9': 'cph_txtStairEvalu',
      '5': 'cph_txtWearEvalu',
      '6': 'cph_txtStoolControl',
      '7': 'cph_txtUrineControl',
    };

    static check(document) {
      return document.querySelector('#cph_cboDisCode_txt')?.value === '03';
    }

    static copy(document, data, options) {
      super.copy(document, data, options);

      data.info.barthal = {};
      for (const [key, id] of Object.entries(this._mapKeyId)) {
        data.info.barthal[key] = document.getElementById(id).value;
      }
      return data;
    }

    static async paste(document, result, options) {
      if (await super.paste(document, result, options)) {
        return true;
      }

      const [{info: {barthal}}] = result.infos;
      for (const key in barthal) {
        const id = this._mapKeyId[key];
        const elem = document.getElementById(id);
        applyValue(elem, barthal[key]);
      }
    }
  }

  const pageTypeMap = {
    _determine(document) {
      for (const [type, handler] of Object.entries(pageTypeMap)) {
        if (handler.check?.(document)) {
          return type;
        }
      }
      return null;
    },
    hosp_cva: PlanHospCva,
    hosp_ici: PlanHospIci,
    hosp_sci: PlanHospSci,
    hosp_dyspnea: PlanHospDyspnea,
    hosp_pop: PlanHospPop,
    ca_hosp: PlanCaHosp,
    ca_opd: PlanCaOpd,
    ar: PlanAr,
    ca_ext: PlanCaExt,
    ckd: PlanCkd,
    special_cva: PlanSpecialCva,
  };

  const scaleTypeMap = {
    _determine(form) {
      for (const [type, handler] of Object.entries(scaleTypeMap)) {
        if (type.startsWith('_')) {
          continue;
        }

        if (handler.checkFrame?.(form)) {
          return type;
        }
      }
      return null;
    },
    barthal: {
      name: '巴氏量表',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssBarthel.aspx';
      },
      copyFrame(form, data) {
        data.info.barthal = {};
        const prefix = 'cph_BLI_SCALE2_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.barthal[key] !== undefined) { continue; }
          data.info.barthal[key] = getRadioValue(elem, {
            parseValue: (elem, elems) => {
              const idx = elem.id.slice(elem.id.lastIndexOf('_') + 1);
              return (elems.length - idx) * 5;
            },
          });
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['barthal']);
        if (result.infos.length !== 1) { return; }

        const [{info: {barthal}}] = result.infos;
        for (const key in barthal ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_BLI_SCALE2_${key}_"]`), barthal[key], {
            parseBoolean: (value, elem, elems) => {
              return elem.id.slice(-1) == elems.length - parseInt(value) / 5;
            },
          });
        }
      },
    },
    nihss: {
      name: 'NIHSS',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssNHISS.aspx';
      },
      copyFrame(form, data) {
        data.info.nihss = {};
        const prefix = 'cph_cboNHISS';
        const cut = prefix.length;
        for (const elem of form.querySelectorAll(`select[id^="${prefix}"]`)) {
          data.info.nihss[elem.id.slice(cut)] = elem.value;
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['nihss']);
        if (result.infos.length !== 1) { return; }

        const [{info: {nihss}}] = result.infos;
        for (const key in nihss ?? {}) {
          const elem = form.querySelector(`#cph_cboNHISS${key}`);
          applyValue(elem, nihss[key]);
        }
      },
    },
    rts: {
      name: 'RTS',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssRTS.aspx';
      },
      copyFrame(form, data) {
        data.info.rts = {};
        const prefix = 'cph_BLI_SCALE2_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.rts[key] !== undefined) { continue; }
          data.info.rts[key] = getRadioValue(elem, {
            parseValue: (elem, elems) => {
              const idx = elem.id.slice(elem.id.lastIndexOf('_') + 1);
              return (elems.length - idx) + (key <= 3 ? 1 : 0);
            },
          });
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['rts']);
        if (result.infos.length !== 1) { return; }

        const [{info: {rts}}] = result.infos;
        for (const key in rts ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_BLI_SCALE2_${key}_"]`), parseInt(rts[key]), {
            parseBoolean: (value, elem, elems) => {
              return elem.id.slice(-1) == elems.length - value + (parseInt(key) <= 3 ? 1 : 0);
            },
          });
        }
      },
    },
    asia: {
      name: 'ASIA',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssASAI.aspx';
      },
      copyFrame(form, data) {
        data.info.asia = {};

        const prefix = 'cph_txt';
        const cut = prefix.length;
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          data.info.asia[elem.id.slice(cut)] = elem.value;
        }

        const prefix2 = 'cph_cbo';
        const cut2 = prefix2.length;
        for (const elem of form.querySelectorAll(`select[id^="${prefix2}"]`)) {
          data.info.asia[elem.id.slice(cut2)] = elem.value;
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['asia']);
        if (result.infos.length !== 1) { return; }

        const [{info: {asia}}] = result.infos;
        if (asia) {
          const prefix = 'cph_txt';
          const cut = prefix.length;
          for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
            applyValue(elem, asia[elem.id.slice(cut)]);
          }

          const prefix2 = 'cph_cbo';
          const cut2 = prefix2.length;
          for (const elem of form.querySelectorAll(`select[id^="${prefix2}"]`)) {
            applyValue(elem, asia[elem.id.slice(cut2)]);
          }
        }
      },
    },
    plan_hosp_dyspnea: {
      name: '呼吸困難數值',
    },
    act: {
      name: 'ACT',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssACT.aspx';
      },
      copyFrame(form, data) {
        data.info.act = {};
        const prefix = 'cph_ACT_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.act[key] !== undefined) { continue; }
          data.info.act[key] = getRadioValue(elem);
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['act']);
        if (result.infos.length !== 1) { return; }

        const [{info: {act}}] = result.infos;
        for (const key in act ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_ACT_${key}_"]`), act[key]);
        }
      },
    },
    cat: {
      name: 'CAT',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssCAT.aspx';
      },
      copyFrame(form, data) {
        data.info.cat = {};
        const prefix = 'cph_CAT_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.cat[key] !== undefined) { continue; }
          data.info.cat[key] = getRadioValue(elem);
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['cat']);
        if (result.infos.length !== 1) { return; }

        const [{info: {cat}}] = result.infos;
        for (const key in cat ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_CAT_${key}_"]`), cat[key]);
        }
      },
    },
    mmrc: {
      name: 'MMRC',
    },
    vas: {
      name: 'VAS',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssVAS.aspx';
      },
      copyFrame(form, data) {
        // #cph_radVAS, #cph_radVAS1, #cph_radVAS2, ...
        data.info.vas = getRadioValue(form.querySelector('#cph_radVAS'), {
          parseValue: (elem, elems) => Number(elem.id.slice(10)),
        });
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['vas']);
        if (result.infos.length !== 1) { return; }

        const [{info: {vas}}] = result.infos;
        if (vas !== undefined) {
          // #cph_radVAS, #cph_radVAS1, #cph_radVAS2, ...
          applyRadioValue(form.querySelectorAll(`input[id^="cph_radVAS"]`), parseInt(vas), {
            parseBoolean: (value, elem, elems) => elem.id.slice(10) == value,
          });
        }
      },
    },
    mcgill: {
      name: 'McGill',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssMcGill.aspx';
      },
      copyFrame(form, data) {
        data.info.mcgill = {};
        const prefix = 'cph_McGill_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.mcgill[key] !== undefined) { continue; }
          data.info.mcgill[key] = getRadioValue(elem);
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['mcgill']);
        if (result.infos.length !== 1) { return; }

        const [{info: {mcgill}}] = result.infos;
        for (const key in mcgill ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_McGill_${key}_"]`), mcgill[key]);
        }
      },
    },
    odi: {
      name: 'ODI',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssODI.aspx';
      },
      copyFrame(form, data) {
        data.info.odi = {};
        const prefix = 'cph_ODI_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.odi[key] !== undefined) { continue; }
          data.info.odi[key] = getRadioValue(elem, {
            parseValue: (elem, elems) => elem.id.slice(elem.id.lastIndexOf('_') + 1) - 1,
          });
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['odi']);
        if (result.infos.length !== 1) { return; }

        const [{info: {odi}}] = result.infos;
        for (const key in odi ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_ODI_${key}_"]`), parseInt(odi[key]) + 1);
        }
      },
    },
    factg: {
      name: 'FACT-G',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssFATG.aspx';
      },
      copyFrame(form, data) {
        data.info.factg = {};

        const prefix = 'cph_BLI_SCALE';
        const map = {1: 'GP1', 2: 'GS2', 3: 'GE3', 4: 'GF4'};
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          let key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          key = map[key.slice(0, 1) - 1] + key.slice(1);
          if (data.info.factg[key] !== undefined) { continue; }
          data.info.factg[key] = getRadioValue(elem, {
            parseValue: (elem, elems) => elem.id.slice(elem.id.lastIndexOf('_') + 1) - 1,
          });
        }

        data.info.factg['ChkGS7'] = form.querySelector(`#cph_ChkGS7`).checked ? "Y" : "N";
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['factg']);
        if (result.infos.length !== 1) { return; }

        const [{info: {factg}}] = result.infos;
        if (factg) {
          const {ChkGS7, ...keys} = factg;

          applyValue(form.querySelector(`#cph_ChkGS7`), ChkGS7);

          for (const key in keys) {
            applyRadioValue(
              form.querySelectorAll(`input[id^="cph_BLI_SCALE${(Number(key.slice(2, 3)) + 1) + key.slice(3)}_"]`),
              parseInt(keys[key]) + 1,
            );
          }
        }
      },
    },
    ecog: {
      name: 'ECOG',
    },
    rcat: {
      name: 'RCAT',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssRCAT.aspx';
      },
      copyFrame(form, data) {
        data.info.rcat = {};
        const prefix = 'cph_rdo';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.rcat[key] !== undefined) { continue; }

          // the page has an issue where the element group members don't share identical name
          data.info.rcat[key] = getRadioValue(form.querySelectorAll(`input[id^="${prefix}${key}_"]`));
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['rcat']);
        if (result.infos.length !== 1) { return; }

        const [{info: {rcat}}] = result.infos;
        for (const key in rcat ?? {}) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_rdo${key}_"]`), rcat[key]);
        }
      },
    },
    ctcae: {
      name: 'CTCAE',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssCTCAE.aspx';
      },
      copyFrame(form, data) {
        data.info.ctcae = {};

        const prefix = 'cph_rad_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.ctcae[key] !== undefined) { continue; }
          data.info.ctcae[key] = getRadioValue(elem);
        }

        const prefix2 = 'cph_txt_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix2}"]`)) {
          const key = 'Txt' + elem.id.slice(prefix2.length);
          if (data.info.ctcae[key] !== undefined) { continue; }
          data.info.ctcae[key] = elem.value;
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['ctcae']);
        if (result.infos.length !== 1) { return; }

        const [{info: {ctcae}}] = result.infos;
        for (const key in ctcae ?? {}) {
          const [, type, idx] = key.match(/^(BEFORE|AFTER|Txt)(.+)$/);
          if (type === 'Txt') {
            const elem = form.querySelector(`#cph_txt_${idx}`);
            applyValue(elem, ctcae[key]);
            continue;
          }
          applyRadioValue(form.querySelectorAll(`input[id^="cph_rad_${type}_${idx}"]`), ctcae[key]);
        }
      },
    },
    bfit: {
      name: 'BFI-T',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssBFIT.aspx';
      },
      copyFrame(form, data) {
        data.info.bfit = {};

        const prefix = 'cph_rdo_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_') + 1);
          if (data.info.bfit[key] !== undefined) { continue; }
          data.info.bfit[key] = getRadioValue(elem, {
            parseValue: (elem, elems) => elem.id.slice(elem.id.lastIndexOf('_') + 1) === 'Y' ? "1" : "2",
          });
        }

        const prefix2 = 'cph_txt_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix2}"]`)) {
          const key = elem.id.slice(prefix2.length, elem.id.lastIndexOf('_'));
          if (data.info.bfit[key] !== undefined) { continue; }
          data.info.bfit[key] = elem.value;
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['bfit']);
        if (result.infos.length !== 1) { return; }

        const [{info: {bfit}}] = result.infos;
        for (const key in bfit ?? {}) {
          const match = key.match(/^(Before|After)(.+)$/);
          if (!match) {
            // TireBefore, TireAfter
            applyRadioValue(form.querySelectorAll(`input[id^="cph_rdo_${key}_"]`), bfit[key], {
              parseBoolean: (value, elem) => (elem.id.slice(elem.id.lastIndexOf('_') + 1) === 'Y' ? "1" : "2") === value,
            });
            continue;
          }
          const elem = form.querySelector(`#cph_txt_${match[1]}_${match[2]}`);
          applyValue(elem, bfit[key]);
        }
      },
    },
    whoqol: {
      name: 'WHOQOL-BREF',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssWHOQOLBREF.aspx';
      },
      copyFrame(form, data) {
        data.info.whoqol = {};
        for (const elem of form.querySelectorAll(`input[id^="cph_rad_"]`)) {
          const key = elem.name.slice(elem.name.lastIndexOf('$') + 1) + '_';
          if (data.info.whoqol[key] !== undefined) { continue; }
          data.info.whoqol[key] = getRadioValue(elem);
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['whoqol']);
        if (result.infos.length !== 1) { return; }

        const [{info: {whoqol}}] = result.infos;
        for (const key in whoqol ?? {}) {
          const [_, type, value] = key.match(/^(BEFORE|AFTER)(.+)$/);
          applyRadioValue(
            form.querySelectorAll(`input:is([id^="cph_rad_${type}_P_${value}"], [id^="cph_rad_${type}_M_${value}"])`),
            whoqol[key],
          );
        }
      },
    },
    eq5d: {
      name: '生活品質量表',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/AssessControl/AssEQ5D.aspx';
      },
      copyFrame(form, data) {
        data.info.eq5d = {};

        const prefix = 'cph_EQ_SCALE2_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.eq5d[key] !== undefined) { continue; }
          data.info.eq5d[key] = getRadioValue(elem);
        }

        data.info.eq5d.HV = form.querySelector('#cph_txtHV').value;
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['eq5d']);
        if (result.infos.length !== 1) { return; }

        const [{info: {eq5d}}] = result.infos;
        const {HV, ...keys} = eq5d;
        for (const key in keys) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_EQ_SCALE2_${key}_"]`), keys[key]);
        }
        applyValue(form.querySelector('#cph_txtHV'), HV);
      },
    },
    ckd2: {
      name: '腎病發現史',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/qp2e5300/QP2E5301S06_2.aspx';
      },
      copyFrame(form, data) {
        data.info.ckd2 = {};
        const prefix = 'cph_radS02_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.ckd2[key] !== undefined) { continue; }
          data.info.ckd2[key] = getRadioValue(elem, {
            parseValue: (elem) => elem.value,
          });
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['ckd2']);
        if (result.infos.length !== 1) { return; }

        const [{info: {ckd2}}] = result.infos;
        for (const key in ckd2) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_radS02_${key}_"]`), ckd2[key], {
            parseBoolean: (value, elem) => elem.value === value,
          });
        }
      },
    },
    ckd3: {
      name: '腎病症狀量表',
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/qp2e5300/QP2E5301S06_3.aspx';
      },
      copyFrame(form, data) {
        data.info.ckd3 = {};

        const prefix = 'cph_radS03_';
        for (const elem of form.querySelectorAll(`input[id^="${prefix}"]`)) {
          const key = elem.id.slice(prefix.length, elem.id.lastIndexOf('_'));
          if (data.info.ckd3[key] !== undefined) { continue; }
          data.info.ckd3[key] = getRadioValue(elem, {
            parseValue: (elem) => elem.value,
          });
        }

        data.info.ckd3['YN'] = getRadioValue(form.querySelectorAll('#cph_radY, #cph_radN'), {
          parseValue: (elem) => elem.id.slice(-1),
        });
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['ckd3']);
        if (result.infos.length !== 1) { return; }

        const [{info: {ckd3}}] = result.infos;
        const {YN, ...keys} = ckd3;
        for (const key in keys) {
          applyRadioValue(form.querySelectorAll(`input[id^="cph_radS03_${key}_"]`), parseInt(keys[key]) - 1);
        }

        applyRadioValue(form.querySelectorAll('#cph_radY, #cph_radN'), YN, {
          parseBoolean: (value, elem) => elem.id.slice(-1) == value,
        });
      },
    },
    ckd4: {
      name: '腎病藥物史',
      _mapKeyId: {
        '1': 'cph_radS04_1_0',
        '2': 'cph_radS04_2_0',
        '3': 'cph_radS04_31',
        '4': 'cph_txtNA1',
        '5': 'cph_radS04_4_0',
        '6': 'cph_txtNA2',
        '7': 'cph_radS04_5_0',
        '8': 'cph_txtNA3',
        '9': 'cph_radS04_6_0',
        '10': 'cph_txtNA4',
        '11': 'cph_radS04_7_0',
        '12': 'cph_txtNA5',
        '13': 'cph_radS04_8_0',
        '14': 'cph_txtMemo',
      },
      checkFrame(form) {
        return form.action === 'https://medvpn.nhi.gov.tw/qp2e5300/QP2E5301S06_4.aspx';
      },
      copyFrame(form, data) {
        data.info.ckd4 = {};
        for (const [key, id] of Object.entries(this._mapKeyId)) {
          const elem = form.querySelector(`#${id}`);
          if (elem.matches('input[type="radio"]')) {
            data.info.ckd4[key] = getRadioValue(elem, {
              parseValue: (elem) => (key === "3") ? (elem.id.slice(-1) === "1" ? "N" : "Y") : (Number(elem.id.slice(-1)) + 1),
            });
          } else {
            data.info.ckd4[key] = elem.value;
          }
        }
      },
      pasteFrame(form, result) {
        result.infos = getFilteredInfos(result.data, ['ckd4']);
        if (result.infos.length !== 1) { return; }

        const [{info: {ckd4}}] = result.infos;
        for (const key in ckd4) {
          const id = this._mapKeyId[key];
          const elem = form.querySelector(`#${id}`);
          if (elem.matches('input[type="radio"]')) {
            applyRadioValue(elem, ckd4[key], {
              parseBoolean: (value, elem) => ((key === "3") ? (elem.id.slice(-1) === "1" ? "N" : "Y") : (Number(elem.id.slice(-1)) + 1)) == value,
            });
          } else {
            applyValue(elem, ckd4[key]);
          }
        }
      },
    },
    plan_ckd: {
      name: '慢性腎病數值',
    },
  };

  /**
   * Copy data from page.
   *
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async function copyFromPage(options) {
    // determine page type
    const pageType = pageTypeMap._determine(document);
    if (!pageType) {
      throw new Error(`無法辨識頁面類型`);
    }
    console.debug('Copying from page (type: "%s")...', pageType);

    // retrieve page data
    const handler = pageTypeMap[pageType];
    if (typeof handler?.copy !== 'function') {
      throw new Error(`不支援的頁面類型: ${pageType}`);
    }

    const data = {id: null, name: null, birth: null, date: null, info: {}};
    await handler.copy(document, data, options);

    // copy from frame if supported
    if (typeof handler?.copyFromFrame === 'function') {
      await handler.copyFromFrame(document, data, options);
    }

    // return data
    const {id, name, birth, date, info} = data;
    const fields = Object.keys(info).map(n => scaleTypeMap[n].name);

    // merge with previous result
    const result = {
      [id]: {
        name,
        birth,
        infos: {
          [date]: info,
        },
      },
    };

    const oldResult = await chrome.storage.session.get(Object.keys(result));
    for (const [id, oldData] of Object.entries(oldResult)) {
      const data = result[id];
      data.name = data.name || oldData.name;
      data.birth = data.birth || oldData.birth;
      for (const [date, info] of Object.entries(oldData.infos)) {
        data.infos[date] = Object.assign({}, info, data.infos[date]);
      }
    }

    await chrome.storage.session.set(result);

    // generate response
    return {id, name, birth, date, fields};
  }

  /**
   * Paste data to page.
   *
   * @param {Object} [options]
   * @param {string} [options.forceDate] - the exact date of data to paste
   * @returns {Promise<Object>}
   */
  async function pasteToPage(options) {
    // determine page type
    const pageType = pageTypeMap._determine(document);
    if (!pageType) {
      throw new Error(`無法辨識頁面類型`);
    }
    console.debug('Pasting to page (type: "%s")...', pageType);

    // paste data to page
    const handler = pageTypeMap[pageType];
    if (typeof handler?.paste !== 'function') {
      throw new Error(`不支援的頁面類型: ${pageType}`);
    }

    const result = {infos: []};
    await handler.paste(document, result, options);

    // generate response
    const {id, infos} = result;
    const pasted = infos.map(({date, info}) => {
      const fields = Object.keys(info).map(n => scaleTypeMap[n].name);
      return {date, fields};
    });
    return {id, pasted};
  }

  function getFilteredInfos(data, names) {
    const infos = [];
    for (const [date, info] of Object.entries(data.infos)) {
      const _info = Object.entries(info).filter(([name]) => names.includes(name));
      if (_info.length === 0) { continue; }
      infos.push({
        date,
        info: _info.reduce((acc, [name, value]) => {
          acc[name] = value;
          return acc;
        }, {}),
      });
    }
    return infos;
  }

  function ping() {
    return true;
  }

  /**
   * Get the radio element group from a member.
   *
   * ref: https://html.spec.whatwg.org/multipage/input.html#radio-button-group
   *
   * @param {HTMLInputElement} elem - the radio element group member
   * @returns {RadioNodeList|HTMLInputElement[]} the radio element group
   */
  function getRadioGroup(elem) {
    if (!elem.name) {
      return [elem];
    }

    const formOwner = elem.closest('form');
    if (formOwner) {
      return formOwner.elements.namedItem(elem.name);
    }

    return Array.prototype.filter.call(
      elem.ownerDocument.querySelectorAll(`[name="${CSS.escape(elem.name)}"]`),
      e => !e.closest('form'),
    );
  }

  /**
   * @callback getRadioValueParseValueCallback
   * @param {Element} elem - currently iterated radio element
   * @param {NodeList<HTMLInputElement>|HTMLInputElement[]} elems - the radio element group to get value from
   * @returns {string} value of the radio element group
   */

  /**
   * Get the value of a radio element group, identified by the same name and
   * usually a common ID prefix.
   *
   * @param {NodeList<HTMLInputElement>|HTMLInputElement[]|HTMLInputElement} elems - the radio element group (or a member) to get value from
   * @param {Object} [options]
   * @param {getRadioValueParseValueCallback} [options.parseValue] - the callback to cast value
   */
  function getRadioValue(elems, {
    parseValue = (elem, elems) => elem.id.slice(elem.id.lastIndexOf('_') + 1),
  } = {}) {
    // get the radio element group if a radio element is provided
    if (elems.length === undefined) {
      elems = getRadioGroup(elems);
    }

    for (const elem of elems) {
      if (elem.checked) {
        return parseValue(elem, elems).toString();
      }
    }

    return "";
  }

  /**
   * @callback applyValueParseBooleanCallback
   * @param {string|number} value - value to apply
   * @param {Element} elem - element to apply value to
   * @returns {boolean} whether elem should be checked
   */

  /**
   * Apply value to an input-like element.
   *
   * @param {Element} elem - element to apply value to
   * @param {string|number} value - value to apply
   * @param {Object} [options]
   * @param {boolean} [options.simulateInput] - whether to simulate user input
   * @param {applyValueParseBooleanCallback} [options.parseBoolean] - the callback to cast value for checkbox
   */
  function applyValue(elem, value, {
    simulateInput = true,
    parseBoolean = (value, elem) => value === 'Y',
  } = {}) {
    if (elem.matches('input[type="checkbox"]')) {
      const toCheck = parseBoolean(value, elem);
      if (elem.checked !== toCheck) {
        if (elem.matches(':disabled')) {
          elem.checked = toCheck;
          simulateInput && triggerInput(elem);
        } else {
          elem.click();
        }
      }
      return;
    }

    if (elem.value !== value) {
      elem.value = value;
      simulateInput && triggerInput(elem);
    }
  }

  /**
   * @callback applyRadioValueParseBooleanCallback
   * @param {string|number} value - value to apply
   * @param {Element} elem - currently iterated radio element
   * @param {NodeList<HTMLInputElement>} elems - the radio element group to apply value to
   * @returns {boolean} whether elem should be checked
   */

  /**
   * Apply value to a radio element group, identified by the same name and
   * usually a common ID prefix.
   *
   * @param {NodeList<HTMLInputElement>|HTMLInputElement[]|HTMLInputElement} elems - the radio element group (or a member) to apply value to
   * @param {string|number} value - value to apply
   * @param {Object} [options]
   * @param {boolean} [options.simulateInput] - whether to simulate user input
   * @param {applyRadioValueParseBooleanCallback} [options.parseBoolean] - the callback to cast value
   */
  function applyRadioValue(elems, value, {
    simulateInput = true,
    parseBoolean = (value, elem) => elem.id.slice(elem.id.lastIndexOf('_') + 1) == value,
  } = {}) {
    // get the radio element group if a radio element is provided
    if (elems.length === undefined) {
      elems = getRadioGroup(elems);
    }

    // check the radio if a value is provided
    if (value || value === 0) {
      for (const elem of elems) {
        const toCheck = parseBoolean(value, elem, elems);
        if (!toCheck) { continue; }
        if (!elem.checked) {
          if (elem.matches(':disabled') || !simulateInput) {
            elem.checked = toCheck;
            simulateInput && triggerInput(elem);
          } else {
            elem.click();
          }
        }
        return;
      }
      // none to check, go to uncheck all
    }

    // uncheck all if no value or the value doesn't match
    for (const elem of elems) {
      if (elem.checked) {
        elem.checked = false;
        simulateInput && triggerInput(elem);
        break;
      }
    }
  }

  /**
   * Simulate user input on an element.
   *
   * @param {Element} elem - element to simulate input event on
   */
  function triggerInput(elem) {
    elem.dispatchEvent(new Event('input', {bubbles: true}));
    elem.dispatchEvent(new Event('change', {bubbles: true}));
  }

  const page = {
    pageTypeMap,
    scaleTypeMap,
    ping,
    copyFromPage,
    pasteToPage,
    applyValue,
    applyRadioValue,
    triggerInput,
  };

  return page;
}));
