import {
  html,
  svg,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";
import { repeat } from "https://cdn.jsdelivr.net/gh/lit/dist@3.0.0/all/lit-all.min.js";
import * as d3 from "https://cdn.skypack.dev/d3@7";

class CircularTimerCard extends LitElement {
  constructor() {
    super();

    this._timeUpdater = 1;
    setInterval(() => {
      this._timeUpdater++;
    }, 1000);

    this.addEventListener("click", this._tap);

    this._mouseIsDown = false;
    this._mouseIsDownTriggered = false;
    this._doubleClickTriggered = false;
    //this.addEventListener("mousedown", this._mousedown);
    //this.addEventListener("touchstart", this._mousedown);
    //this.addEventListener("mouseup", this._mouseup);
    //this.addEventListener("touchend", this._mouseup);
    //this.addEventListener("dblclick", this._double_tap);
  }


  static get properties() {
    return {
      _config: {},
      _timeUpdater: {},
    };
  }

  setConfig(config) {
    this._actionConfig = {
      entity: config.entity,
      hold_action: {
        action: "more-info",
        start_listening: true,
      },
    };

    this._config = config;
    this._name = config.name || "use_entity_friendly_name";
    this._icon = config.icon || "mdi:timer";
    this._bins = config.bins || 60;
    this._seqmentSize = 360 / this._bins;
    this._primaryInfo = config.primary_info || "timer";
    this._secondaryInfo = config.secondary_info || "name";
    this._secondaryInfoSize = config.secondary_info_size || "30px";
    this._layout = config.layout || "circle";
    this._padAngle = config.pad_angle || 1;
    this._circleType = config.circle_type || "second";
    this._cornerRadius = config.corner_radius || 4;
    this._colorState = config.color_state || false;
    this._stateColor = getComputedStyle(
      document.documentElement
    ).getPropertyValue("--primary-text-color");
    this._defaultTimerEmptyFill = config.empty_bar_color || "#fdfdfd00";
    this._tapAction = config.tap_action || "toggle";
    this._holdAction = config.hold_action || "more_info";
    this._doubleTapAction = config.double_tap_action || "toggle";
    this._defaultTimerFill = getComputedStyle(
      document.documentElement
    ).getPropertyValue("--primary-color");
    this._gradientColors = [this._defaultTimerFill, this._defaultTimerFill];

    if (config.color) {
      if (config.color.length === 1) {
        this._gradientColors = [config.color[0], config.color[0]];
      } else {
        this._gradientColors = config.color;
      }
    }

    if (config.secondary_info_size) {
      this._secondaryInfoSize = config.secondary_info_size;
    } else {
      if (config.layout === "minimal") {
        this._secondaryInfoSize = "80%";
      } else {
        this._secondaryInfoSize = "160%";
      }
    }

    this._colorScale = d3.scaleSequential(
      d3.interpolateRgbBasis(this._gradientColors)
    );
    this._arc = d3
      .arc()
      .innerRadius(30)
      .outerRadius(48)
      .startAngle((d) => {
        return this._toRadians(d.start);
      })
      .endAngle((d) => {
        return this._toRadians(d.end);
      })
      .cornerRadius(this._cornerRadius)
      .padAngle(this._toRadians(this._padAngle));

    this._arcData = this._generateArcData();
    this._barData = this._generateBarData();
  }
  render() {
    if (!this.hass || !this._config) return html`<ha-card>Loading...</ha-card>`;

    this._stateObj = this.hass.states[this._config.entity];
    if (!this._stateObj) {
      return html`<ha-card>Unknown entity: ${this._config.entity}</ha-card>`;
    }

    if (this._name === "use_entity_friendly_name") {
      this._name = this._stateObj.attributes.friendly_name;
    }

    let icon = this._icon === "use_entity_icon" ? this._stateObj.attributes.icon : this._icon;
    let iconStyle = this._icon === "none" ? "display:none;" : "";

    let dSec = 0;
    let dMinute = 0;
    let dHour = 0;
    let proc = 0;
    let limitBin = 0; 

    if (this._stateObj.state !== "on" )
      this._history_ready = false;

    if (this._stateObj.state === "on" && !this._fetching && !this._history_ready) {
      this._history = null;
      this._fetchHistory(this._config.entity);
    }

    if (this._stateObj.state === "on" && this._history) 
    {
      this._off_count = 0;
      const onTime = this._getEntityOnTime(this._history);
      if(onTime){
        const timeGap = this._calculateTimeDifference(onTime).split(':');
        dSec = +timeGap[0] * 60 * 60 + +timeGap[1] * 60 + +timeGap[2];
        dMinute = +timeGap[0] * 60 + +timeGap[1];
        dHour = +timeGap[0];
  
        if (this._circleType === "minute"){
          proc = dMinute % this._bins  / this._bins;
          if(dMinute > 0 && proc == 0) proc = 1;
        }
        else if (this._circleType === "hour"){
         proc = dHour % this._bins / this._bins;
          if(dHour > 0 && proc == 0) proc = 1;
        }
        else if (this._circleType === "second"){
          proc = dSec % this._bins / this._bins;
          if(dSec > 0 && proc == 0) proc = 1;
        }
        
        limitBin = Math.floor(this._bins * proc);
      }
    }
    
    const colorData = this._generateArcColorData(limitBin);
    const textColor = this._getTextColor(proc);

    const displayDSec = this._getTimeString(dSec);
    const primaryInfo = this._primaryInfo === "timer" ? displayDSec : this._name;
    const secondaryInfo = this._secondaryInfo === "name" ? this._name : displayDSec;

    return html`
      <ha-card>
        ${this._layout === "minimal" ? this._renderMinimalLayout(icon, iconStyle, textColor, primaryInfo, secondaryInfo, limitBin, colorData) : this._renderDefaultLayout(icon, iconStyle,textColor, primaryInfo, secondaryInfo, limitBin, colorData)}
      </ha-card>
    `;
  }

  _renderMinimalLayout(icon, iconStyle, textColor, primaryInfo, secondaryInfo, limitBin, colorData) {
    return html`

      <div class="header">
        <div class="innerheader">
          <div class="icon clickable " style="${iconStyle}">
            <ha-icon class="hoverable" icon="${icon}" style="color: ${textColor};"></ha-icon>
          </div>
          <div class="info">
            <span class="primary" style="color: ${textColor};">${secondaryInfo}</span>
            <span class="secondary" style="font-size:${this._secondaryInfoSize};color: ${textColor};">${primaryInfo}</span>
          </div>
        </div>
        
          <svg viewBox="0 0 100 8" class="minimalsvg">
            <g transform="translate(0,0)">
              ${repeat(this._barData, d => d.id, (d, index) => svg`
                <rect x=${d.x} y=${d.y} width=${d.width} height=${d.height} rx="0.5" fill=${this._getBinColor(colorData, index, limitBin)} />
              `)}
            </g>
          </svg>
        </div>
    `;
  }

  _renderDefaultLayout(icon, iconStyle, textColor, primaryInfo, secondaryInfo, limitBin, colorData) {
    return html`
 
        <div name="div1" class="centerlayout  centerhover">
          <ha-icon class="icon2" icon="${icon}" style="color: ${textColor};"></ha-icon>
          <span id="countdown" style="color:${textColor};font-size: 370%;
          text-shadow: -1px -1px 0 var(--primary-background-color),  
                        1px -1px 0 var(--primary-background-color),
                       -1px 1px 0 var(--primary-background-color),
                        1px 1px 0 var(--primary-background-color);">${primaryInfo}</span>
          <span id="timer-name" style="color:${textColor}; font-size:${this._secondaryInfoSize};">${secondaryInfo}</span>
        </div>

        <div name="div2" style="position: relative;z-index: 1;transition: transform 0.8s ease;">
          <svg viewBox="0 0 100 100">
            <g transform="translate(50,50)">
              ${repeat(this._arcData, d => d.id, (d, index) => svg`
                <path class="arc" d=${d.arc} fill=${this._getBinColor(colorData, index, limitBin)} />
              `)}
            </g>
          </svg>
        </div>
    
    `;
  }

  _generateArcData() {
    var data = [];
    for (var i = 0; i < this._bins; i++) {
      data.push({
        arc: this._arc({
          start: i * this._seqmentSize,
          end: (i + 1) * this._seqmentSize,
        }),
        id: i,
      });
    }
    return data;
  }

  _generateBarData() {
    var pad = 1;

    var width = (100 + this._padAngle) / this._bins - this._padAngle;
    var height = 8;

    var data = [];
    for (var i = 0; i < this._bins; i++) {
      var x = i * (width + this._padAngle);
      var y = 0;

      data.push({ x: x, y: y, width: width, height: height, id: i });
    }
    return data;
  }

  _generateArcColorData(limitBin) {
    var data = [];
    for (var i = 0; i < this._bins; i++) {
      var color;
      if (i < limitBin) {
        color = this._colorScale(i / (this._bins - 1));
      } else {
        color = this._defaultTimerEmptyFill;
      }

      data.push(color);
    }
    return data;
  }

  _getTextColor(proc) {
    if (this._stateObj.state == "on") return this._colorScale(proc);
    else return "#909497";
  }

  _getBinColor(colorData, index, limitBin) {
    if (this._stateObj.state == "on") {
      return colorData[index];
    } else {
      if (index < limitBin) return "#909497";
      else return colorData[index];
    }
  }

  _toRadians(deg) {
    return deg * (Math.PI / 180);
  }

  _getTimeString(s) {
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var s = Math.floor((s % 3600) % 60);

    var hours = h.toString().padStart(2, "0");
    var minutes = m.toString().padStart(2, "0");
    var seconds = s.toString().padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  _toggle_func() {
    this.hass.callService("switch", "toggle", {
      entity_id: this._config.entity,
    });
  }

  _cancel_func() {
    const stateObj = this.hass.states[this._config.entity];
    this.hass.callService("timer", "cancel", {
      entity_id: this._config.entity,
    });
  }

  _moreInfo_func() {
    var event = new Event("hass-action", {
      bubbles: true,
      composed: true,
    });
    event.detail = {
      config: this._actionConfig,
      action: "hold",
    };
    this.dispatchEvent(event);
  }

  _tap(e) {
    if (this._mouseIsDownTriggered == false) {
      setTimeout(() => {
        if (this._doubleClickTriggered == false) {
          if (this._tapAction == "toggle") {
            this._toggle_func();
          } else if (this._tapAction == "more_info") {
            this._moreInfo_func();
          } else if (this._tapAction == "cancel") {
            this._cancel_func();
          }
        }
      }, 200);
    }
  }

  _double_tap(e) {
    this._doubleClickTriggered = true;
    if (this._doubleTapAction == "toggle") {
      this._toggle_func();
    } else if (this._doubleTapAction == "more_info") {
      this._moreInfo_func();
    } else if (this._doubleTapAction == "cancel") {
      this._cancel_func();
    }
    setTimeout(() => {
      this._doubleClickTriggered = false;
    }, 500);
  }

  _mousedown(e) {
    this._mouseIsDown = true;
    setTimeout(() => {
      if (this._mouseIsDown) {
        this._mouseIsDownTriggered = true;
        if (this._holdAction == "toggle") {
          this._toggle_func();
        } else if (this._holdAction == "more_info") {
          this._moreInfo_func();
        } else if (this._holdAction == "cancel") {
          this._cancel_func();
        }
      }
    }, 1000);
  }

  _mouseup(e) {
    setTimeout(() => {
      this._mouseIsDown = false;
      this._mouseIsDownTriggered = false;
    }, 100);
  }

  _fetchHistory(entity) {
    this._fetching = true;
    fetch(`/api/history/period?filter_entity_id=${entity}`, {
      headers: { Authorization: `Bearer ${this._config.token}` },
    })
      .then(response => response.json())
      .then(data => {
        this._history = data;
        this._history_ready = true;
        this._fetching = false;
        this.requestUpdate();
      })
      .catch(error => {
        console.error('Error fetching history:', error);
        this._fetching = false;
      });
  }
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _getEntityOnTime(history) {
    const data = history[0];
    if(data[data.length - 1].state === "on"){
      return  new Date(data[data.length - 1].last_changed);
    }
    else{
      this._history_ready = false;
      return null;
    }
  }

  _calculateTimeDifference(lastOnTime) {
    if (!lastOnTime) return "0:0:0";
    const now = new Date();
    var diff = now - lastOnTime;
    if (diff < 0) diff = 0;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}:${minutes}:${seconds}`;
  }


  static get styles() {
    return css`
      ha-card {
        padding: 16px;
      }

      path:hover {
        opacity: 0.85;
      }
      rect:hover {
        opacity: 0.85;
      }
      #countdown {
        font-weight: 600;
        font-size: 85%;
      }
      #timer-name {
        font-weight: 600;
        text-transform: capitalize;
      }
      #compact-countdown {
        font-weight: 600;
        font-size: 35%;
      }

      .header {
        width: 100%;
        height: 96px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;

      }

      .innerheader {
        display: flex;
        padding: 0px;
        justify-content: flex-start;
        cursor: pointer;

        margin-bottom: 16px;
      }

      .minimalsvg {
        width: 100%;
        height: 40px;
      }
      
      .centerlayout {
        position: absolute;
        width: calc(100% - 32px);
        height: calc(92% - 32px);
        display: flex;
        flex-direction: column;
        justify-content: space-between; 
        align-items: center; 
        justify-content: center;
        z-index: 2;
      }

      .centerlayout > * {
        margin: 10px 0;
      }

      .centerhover {
        transition: transform 0.8s ease;
      }
      .centerhover:hover {
        transform: scale(1.2); /* 鼠标悬停时放大为原来的1.2倍 */
      }
      
      .centerhover:hover + div[name="div2"] {
        transform: scale(0.8); /* 鼠标悬停时缩小为原来的0.8倍 */
      }

      ha-icon {
        color: rgba(189, 189, 189, 1);
      }

      .info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 100%;
        font-weight: 700;

        min-width: 0;
      }

      .info span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .primary {
        color: var(--primary-text-color);

        font-size: 14px;
      }

      .secondary {
        color: var(--secondary-text-color);
        text-transform: capitalize;
      }

      .my-custom-card {
        background-color: var(--lovelace-background-color);
      }

      .icon {
        width: 40px;
        height: 40px;

        flex-shrink: 0;

        display: flex;
        align-items: center;
        justify-content: center;

        margin-right: 16px;

        background: rgba(34, 34, 34, 0.05);
        border-radius: 500px;
      }

      .icon2 {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(34, 34, 34, 0.05);
        border-radius: 500px;
      }

      @keyframes clickAnimation {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(0.9);
        }
        100% {
          transform: scale(1);
        }
      }

      .clickable:active {
        animation: clickAnimation 0.2s ease;
      }

      .hoverable {
        transition: transform 0.5s ease;
      }
      
      .hoverable:hover {
        transform: scale(1.2);
        color: blue;
      }
    `;
  }
}

customElements.define("circular-timer-card", CircularTimerCard);

console.info(
  `%c circular-timer-card | Version 1.1 `,
  "color: white; font-weight: bold; background: #FF4F00"
);
