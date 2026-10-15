(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/qrcode/lib/can-promise.js
  var require_can_promise = __commonJS({
    "node_modules/qrcode/lib/can-promise.js"(exports, module) {
      module.exports = function() {
        return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
      };
    }
  });

  // node_modules/qrcode/lib/core/utils.js
  var require_utils = __commonJS({
    "node_modules/qrcode/lib/core/utils.js"(exports) {
      var toSJISFunction;
      var CODEWORDS_COUNT = [
        0,
        // Not used
        26,
        44,
        70,
        100,
        134,
        172,
        196,
        242,
        292,
        346,
        404,
        466,
        532,
        581,
        655,
        733,
        815,
        901,
        991,
        1085,
        1156,
        1258,
        1364,
        1474,
        1588,
        1706,
        1828,
        1921,
        2051,
        2185,
        2323,
        2465,
        2611,
        2761,
        2876,
        3034,
        3196,
        3362,
        3532,
        3706
      ];
      exports.getSymbolSize = function getSymbolSize(version) {
        if (!version) throw new Error('"version" cannot be null or undefined');
        if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
        return version * 4 + 17;
      };
      exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
        return CODEWORDS_COUNT[version];
      };
      exports.getBCHDigit = function(data) {
        let digit = 0;
        while (data !== 0) {
          digit++;
          data >>>= 1;
        }
        return digit;
      };
      exports.setToSJISFunction = function setToSJISFunction(f) {
        if (typeof f !== "function") {
          throw new Error('"toSJISFunc" is not a valid function.');
        }
        toSJISFunction = f;
      };
      exports.isKanjiModeEnabled = function() {
        return typeof toSJISFunction !== "undefined";
      };
      exports.toSJIS = function toSJIS(kanji) {
        return toSJISFunction(kanji);
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-level.js
  var require_error_correction_level = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-level.js"(exports) {
      exports.L = { bit: 1 };
      exports.M = { bit: 0 };
      exports.Q = { bit: 3 };
      exports.H = { bit: 2 };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "l":
          case "low":
            return exports.L;
          case "m":
          case "medium":
            return exports.M;
          case "q":
          case "quartile":
            return exports.Q;
          case "h":
          case "high":
            return exports.H;
          default:
            throw new Error("Unknown EC Level: " + string);
        }
      }
      exports.isValid = function isValid(level) {
        return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
      };
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/bit-buffer.js
  var require_bit_buffer = __commonJS({
    "node_modules/qrcode/lib/core/bit-buffer.js"(exports, module) {
      function BitBuffer() {
        this.buffer = [];
        this.length = 0;
      }
      BitBuffer.prototype = {
        get: function(index) {
          const bufIndex = Math.floor(index / 8);
          return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
        },
        put: function(num, length) {
          for (let i = 0; i < length; i++) {
            this.putBit((num >>> length - i - 1 & 1) === 1);
          }
        },
        getLengthInBits: function() {
          return this.length;
        },
        putBit: function(bit) {
          const bufIndex = Math.floor(this.length / 8);
          if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
          }
          if (bit) {
            this.buffer[bufIndex] |= 128 >>> this.length % 8;
          }
          this.length++;
        }
      };
      module.exports = BitBuffer;
    }
  });

  // node_modules/qrcode/lib/core/bit-matrix.js
  var require_bit_matrix = __commonJS({
    "node_modules/qrcode/lib/core/bit-matrix.js"(exports, module) {
      function BitMatrix(size) {
        if (!size || size < 1) {
          throw new Error("BitMatrix size must be defined and greater than 0");
        }
        this.size = size;
        this.data = new Uint8Array(size * size);
        this.reservedBit = new Uint8Array(size * size);
      }
      BitMatrix.prototype.set = function(row, col, value, reserved) {
        const index = row * this.size + col;
        this.data[index] = value;
        if (reserved) this.reservedBit[index] = true;
      };
      BitMatrix.prototype.get = function(row, col) {
        return this.data[row * this.size + col];
      };
      BitMatrix.prototype.xor = function(row, col, value) {
        this.data[row * this.size + col] ^= value;
      };
      BitMatrix.prototype.isReserved = function(row, col) {
        return this.reservedBit[row * this.size + col];
      };
      module.exports = BitMatrix;
    }
  });

  // node_modules/qrcode/lib/core/alignment-pattern.js
  var require_alignment_pattern = __commonJS({
    "node_modules/qrcode/lib/core/alignment-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      exports.getRowColCoords = function getRowColCoords(version) {
        if (version === 1) return [];
        const posCount = Math.floor(version / 7) + 2;
        const size = getSymbolSize(version);
        const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
        const positions = [size - 7];
        for (let i = 1; i < posCount - 1; i++) {
          positions[i] = positions[i - 1] - intervals;
        }
        positions.push(6);
        return positions.reverse();
      };
      exports.getPositions = function getPositions(version) {
        const coords = [];
        const pos = exports.getRowColCoords(version);
        const posLength = pos.length;
        for (let i = 0; i < posLength; i++) {
          for (let j = 0; j < posLength; j++) {
            if (i === 0 && j === 0 || // top-left
            i === 0 && j === posLength - 1 || // bottom-left
            i === posLength - 1 && j === 0) {
              continue;
            }
            coords.push([pos[i], pos[j]]);
          }
        }
        return coords;
      };
    }
  });

  // node_modules/qrcode/lib/core/finder-pattern.js
  var require_finder_pattern = __commonJS({
    "node_modules/qrcode/lib/core/finder-pattern.js"(exports) {
      var getSymbolSize = require_utils().getSymbolSize;
      var FINDER_PATTERN_SIZE = 7;
      exports.getPositions = function getPositions(version) {
        const size = getSymbolSize(version);
        return [
          // top-left
          [0, 0],
          // top-right
          [size - FINDER_PATTERN_SIZE, 0],
          // bottom-left
          [0, size - FINDER_PATTERN_SIZE]
        ];
      };
    }
  });

  // node_modules/qrcode/lib/core/mask-pattern.js
  var require_mask_pattern = __commonJS({
    "node_modules/qrcode/lib/core/mask-pattern.js"(exports) {
      exports.Patterns = {
        PATTERN000: 0,
        PATTERN001: 1,
        PATTERN010: 2,
        PATTERN011: 3,
        PATTERN100: 4,
        PATTERN101: 5,
        PATTERN110: 6,
        PATTERN111: 7
      };
      var PenaltyScores = {
        N1: 3,
        N2: 3,
        N3: 40,
        N4: 10
      };
      exports.isValid = function isValid(mask) {
        return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
      };
      exports.from = function from(value) {
        return exports.isValid(value) ? parseInt(value, 10) : void 0;
      };
      exports.getPenaltyN1 = function getPenaltyN1(data) {
        const size = data.size;
        let points = 0;
        let sameCountCol = 0;
        let sameCountRow = 0;
        let lastCol = null;
        let lastRow = null;
        for (let row = 0; row < size; row++) {
          sameCountCol = sameCountRow = 0;
          lastCol = lastRow = null;
          for (let col = 0; col < size; col++) {
            let module2 = data.get(row, col);
            if (module2 === lastCol) {
              sameCountCol++;
            } else {
              if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
              lastCol = module2;
              sameCountCol = 1;
            }
            module2 = data.get(col, row);
            if (module2 === lastRow) {
              sameCountRow++;
            } else {
              if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
              lastRow = module2;
              sameCountRow = 1;
            }
          }
          if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
          if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
        }
        return points;
      };
      exports.getPenaltyN2 = function getPenaltyN2(data) {
        const size = data.size;
        let points = 0;
        for (let row = 0; row < size - 1; row++) {
          for (let col = 0; col < size - 1; col++) {
            const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
            if (last === 4 || last === 0) points++;
          }
        }
        return points * PenaltyScores.N2;
      };
      exports.getPenaltyN3 = function getPenaltyN3(data) {
        const size = data.size;
        let points = 0;
        let bitsCol = 0;
        let bitsRow = 0;
        for (let row = 0; row < size; row++) {
          bitsCol = bitsRow = 0;
          for (let col = 0; col < size; col++) {
            bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
            if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
            bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
            if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
          }
        }
        return points * PenaltyScores.N3;
      };
      exports.getPenaltyN4 = function getPenaltyN4(data) {
        let darkCount = 0;
        const modulesCount = data.data.length;
        for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
        const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
        return k * PenaltyScores.N4;
      };
      function getMaskAt(maskPattern, i, j) {
        switch (maskPattern) {
          case exports.Patterns.PATTERN000:
            return (i + j) % 2 === 0;
          case exports.Patterns.PATTERN001:
            return i % 2 === 0;
          case exports.Patterns.PATTERN010:
            return j % 3 === 0;
          case exports.Patterns.PATTERN011:
            return (i + j) % 3 === 0;
          case exports.Patterns.PATTERN100:
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
          case exports.Patterns.PATTERN101:
            return i * j % 2 + i * j % 3 === 0;
          case exports.Patterns.PATTERN110:
            return (i * j % 2 + i * j % 3) % 2 === 0;
          case exports.Patterns.PATTERN111:
            return (i * j % 3 + (i + j) % 2) % 2 === 0;
          default:
            throw new Error("bad maskPattern:" + maskPattern);
        }
      }
      exports.applyMask = function applyMask2(pattern, data) {
        const size = data.size;
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            if (data.isReserved(row, col)) continue;
            data.xor(row, col, getMaskAt(pattern, row, col));
          }
        }
      };
      exports.getBestMask = function getBestMask(data, setupFormatFunc) {
        const numPatterns = Object.keys(exports.Patterns).length;
        let bestPattern = 0;
        let lowerPenalty = Infinity;
        for (let p = 0; p < numPatterns; p++) {
          setupFormatFunc(p);
          exports.applyMask(p, data);
          const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
          exports.applyMask(p, data);
          if (penalty < lowerPenalty) {
            lowerPenalty = penalty;
            bestPattern = p;
          }
        }
        return bestPattern;
      };
    }
  });

  // node_modules/qrcode/lib/core/error-correction-code.js
  var require_error_correction_code = __commonJS({
    "node_modules/qrcode/lib/core/error-correction-code.js"(exports) {
      var ECLevel = require_error_correction_level();
      var EC_BLOCKS_TABLE = [
        // L  M  Q  H
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        2,
        2,
        4,
        1,
        2,
        4,
        4,
        2,
        4,
        4,
        4,
        2,
        4,
        6,
        5,
        2,
        4,
        6,
        6,
        2,
        5,
        8,
        8,
        4,
        5,
        8,
        8,
        4,
        5,
        8,
        11,
        4,
        8,
        10,
        11,
        4,
        9,
        12,
        16,
        4,
        9,
        16,
        16,
        6,
        10,
        12,
        18,
        6,
        10,
        17,
        16,
        6,
        11,
        16,
        19,
        6,
        13,
        18,
        21,
        7,
        14,
        21,
        25,
        8,
        16,
        20,
        25,
        8,
        17,
        23,
        25,
        9,
        17,
        23,
        34,
        9,
        18,
        25,
        30,
        10,
        20,
        27,
        32,
        12,
        21,
        29,
        35,
        12,
        23,
        34,
        37,
        12,
        25,
        34,
        40,
        13,
        26,
        35,
        42,
        14,
        28,
        38,
        45,
        15,
        29,
        40,
        48,
        16,
        31,
        43,
        51,
        17,
        33,
        45,
        54,
        18,
        35,
        48,
        57,
        19,
        37,
        51,
        60,
        19,
        38,
        53,
        63,
        20,
        40,
        56,
        66,
        21,
        43,
        59,
        70,
        22,
        45,
        62,
        74,
        24,
        47,
        65,
        77,
        25,
        49,
        68,
        81
      ];
      var EC_CODEWORDS_TABLE = [
        // L  M  Q  H
        7,
        10,
        13,
        17,
        10,
        16,
        22,
        28,
        15,
        26,
        36,
        44,
        20,
        36,
        52,
        64,
        26,
        48,
        72,
        88,
        36,
        64,
        96,
        112,
        40,
        72,
        108,
        130,
        48,
        88,
        132,
        156,
        60,
        110,
        160,
        192,
        72,
        130,
        192,
        224,
        80,
        150,
        224,
        264,
        96,
        176,
        260,
        308,
        104,
        198,
        288,
        352,
        120,
        216,
        320,
        384,
        132,
        240,
        360,
        432,
        144,
        280,
        408,
        480,
        168,
        308,
        448,
        532,
        180,
        338,
        504,
        588,
        196,
        364,
        546,
        650,
        224,
        416,
        600,
        700,
        224,
        442,
        644,
        750,
        252,
        476,
        690,
        816,
        270,
        504,
        750,
        900,
        300,
        560,
        810,
        960,
        312,
        588,
        870,
        1050,
        336,
        644,
        952,
        1110,
        360,
        700,
        1020,
        1200,
        390,
        728,
        1050,
        1260,
        420,
        784,
        1140,
        1350,
        450,
        812,
        1200,
        1440,
        480,
        868,
        1290,
        1530,
        510,
        924,
        1350,
        1620,
        540,
        980,
        1440,
        1710,
        570,
        1036,
        1530,
        1800,
        570,
        1064,
        1590,
        1890,
        600,
        1120,
        1680,
        1980,
        630,
        1204,
        1770,
        2100,
        660,
        1260,
        1860,
        2220,
        720,
        1316,
        1950,
        2310,
        750,
        1372,
        2040,
        2430
      ];
      exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
      exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
        switch (errorCorrectionLevel) {
          case ECLevel.L:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
          case ECLevel.M:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
          case ECLevel.Q:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
          case ECLevel.H:
            return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
          default:
            return void 0;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/galois-field.js
  var require_galois_field = __commonJS({
    "node_modules/qrcode/lib/core/galois-field.js"(exports) {
      var EXP_TABLE = new Uint8Array(512);
      var LOG_TABLE = new Uint8Array(256);
      (function initTables() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
          EXP_TABLE[i] = x;
          LOG_TABLE[x] = i;
          x <<= 1;
          if (x & 256) {
            x ^= 285;
          }
        }
        for (let i = 255; i < 512; i++) {
          EXP_TABLE[i] = EXP_TABLE[i - 255];
        }
      })();
      exports.log = function log(n) {
        if (n < 1) throw new Error("log(" + n + ")");
        return LOG_TABLE[n];
      };
      exports.exp = function exp(n) {
        return EXP_TABLE[n];
      };
      exports.mul = function mul(x, y) {
        if (x === 0 || y === 0) return 0;
        return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
      };
    }
  });

  // node_modules/qrcode/lib/core/polynomial.js
  var require_polynomial = __commonJS({
    "node_modules/qrcode/lib/core/polynomial.js"(exports) {
      var GF = require_galois_field();
      exports.mul = function mul(p1, p2) {
        const coeff = new Uint8Array(p1.length + p2.length - 1);
        for (let i = 0; i < p1.length; i++) {
          for (let j = 0; j < p2.length; j++) {
            coeff[i + j] ^= GF.mul(p1[i], p2[j]);
          }
        }
        return coeff;
      };
      exports.mod = function mod(divident, divisor) {
        let result = new Uint8Array(divident);
        while (result.length - divisor.length >= 0) {
          const coeff = result[0];
          for (let i = 0; i < divisor.length; i++) {
            result[i] ^= GF.mul(divisor[i], coeff);
          }
          let offset = 0;
          while (offset < result.length && result[offset] === 0) offset++;
          result = result.slice(offset);
        }
        return result;
      };
      exports.generateECPolynomial = function generateECPolynomial(degree) {
        let poly = new Uint8Array([1]);
        for (let i = 0; i < degree; i++) {
          poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
        }
        return poly;
      };
    }
  });

  // node_modules/qrcode/lib/core/reed-solomon-encoder.js
  var require_reed_solomon_encoder = __commonJS({
    "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports, module) {
      var Polynomial = require_polynomial();
      function ReedSolomonEncoder(degree) {
        this.genPoly = void 0;
        this.degree = degree;
        if (this.degree) this.initialize(this.degree);
      }
      ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
        this.degree = degree;
        this.genPoly = Polynomial.generateECPolynomial(this.degree);
      };
      ReedSolomonEncoder.prototype.encode = function encode(data) {
        if (!this.genPoly) {
          throw new Error("Encoder not initialized");
        }
        const paddedData = new Uint8Array(data.length + this.degree);
        paddedData.set(data);
        const remainder = Polynomial.mod(paddedData, this.genPoly);
        const start = this.degree - remainder.length;
        if (start > 0) {
          const buff = new Uint8Array(this.degree);
          buff.set(remainder, start);
          return buff;
        }
        return remainder;
      };
      module.exports = ReedSolomonEncoder;
    }
  });

  // node_modules/qrcode/lib/core/version-check.js
  var require_version_check = __commonJS({
    "node_modules/qrcode/lib/core/version-check.js"(exports) {
      exports.isValid = function isValid(version) {
        return !isNaN(version) && version >= 1 && version <= 40;
      };
    }
  });

  // node_modules/qrcode/lib/core/regex.js
  var require_regex = __commonJS({
    "node_modules/qrcode/lib/core/regex.js"(exports) {
      var numeric = "[0-9]+";
      var alphanumeric = "[A-Z $%*+\\-./:]+";
      var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
      kanji = kanji.replace(/u/g, "\\u");
      var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
      exports.KANJI = new RegExp(kanji, "g");
      exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
      exports.BYTE = new RegExp(byte, "g");
      exports.NUMERIC = new RegExp(numeric, "g");
      exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
      var TEST_KANJI = new RegExp("^" + kanji + "$");
      var TEST_NUMERIC = new RegExp("^" + numeric + "$");
      var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
      exports.testKanji = function testKanji(str) {
        return TEST_KANJI.test(str);
      };
      exports.testNumeric = function testNumeric(str) {
        return TEST_NUMERIC.test(str);
      };
      exports.testAlphanumeric = function testAlphanumeric(str) {
        return TEST_ALPHANUMERIC.test(str);
      };
    }
  });

  // node_modules/qrcode/lib/core/mode.js
  var require_mode = __commonJS({
    "node_modules/qrcode/lib/core/mode.js"(exports) {
      var VersionCheck = require_version_check();
      var Regex = require_regex();
      exports.NUMERIC = {
        id: "Numeric",
        bit: 1 << 0,
        ccBits: [10, 12, 14]
      };
      exports.ALPHANUMERIC = {
        id: "Alphanumeric",
        bit: 1 << 1,
        ccBits: [9, 11, 13]
      };
      exports.BYTE = {
        id: "Byte",
        bit: 1 << 2,
        ccBits: [8, 16, 16]
      };
      exports.KANJI = {
        id: "Kanji",
        bit: 1 << 3,
        ccBits: [8, 10, 12]
      };
      exports.MIXED = {
        bit: -1
      };
      exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
        if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid version: " + version);
        }
        if (version >= 1 && version < 10) return mode.ccBits[0];
        else if (version < 27) return mode.ccBits[1];
        return mode.ccBits[2];
      };
      exports.getBestModeForData = function getBestModeForData(dataStr) {
        if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
        else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
        else if (Regex.testKanji(dataStr)) return exports.KANJI;
        else return exports.BYTE;
      };
      exports.toString = function toString(mode) {
        if (mode && mode.id) return mode.id;
        throw new Error("Invalid mode");
      };
      exports.isValid = function isValid(mode) {
        return mode && mode.bit && mode.ccBits;
      };
      function fromString(string) {
        if (typeof string !== "string") {
          throw new Error("Param is not a string");
        }
        const lcStr = string.toLowerCase();
        switch (lcStr) {
          case "numeric":
            return exports.NUMERIC;
          case "alphanumeric":
            return exports.ALPHANUMERIC;
          case "kanji":
            return exports.KANJI;
          case "byte":
            return exports.BYTE;
          default:
            throw new Error("Unknown mode: " + string);
        }
      }
      exports.from = function from(value, defaultValue) {
        if (exports.isValid(value)) {
          return value;
        }
        try {
          return fromString(value);
        } catch (e) {
          return defaultValue;
        }
      };
    }
  });

  // node_modules/qrcode/lib/core/version.js
  var require_version = __commonJS({
    "node_modules/qrcode/lib/core/version.js"(exports) {
      var Utils = require_utils();
      var ECCode = require_error_correction_code();
      var ECLevel = require_error_correction_level();
      var Mode = require_mode();
      var VersionCheck = require_version_check();
      var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
      var G18_BCH = Utils.getBCHDigit(G18);
      function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      function getReservedBitsCount(mode, version) {
        return Mode.getCharCountIndicator(mode, version) + 4;
      }
      function getTotalBitsFromDataArray(segments, version) {
        let totalBits = 0;
        segments.forEach(function(data) {
          const reservedBits = getReservedBitsCount(data.mode, version);
          totalBits += reservedBits + data.getBitsLength();
        });
        return totalBits;
      }
      function getBestVersionForMixedData(segments, errorCorrectionLevel) {
        for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
          const length = getTotalBitsFromDataArray(segments, currentVersion);
          if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
            return currentVersion;
          }
        }
        return void 0;
      }
      exports.from = function from(value, defaultValue) {
        if (VersionCheck.isValid(value)) {
          return parseInt(value, 10);
        }
        return defaultValue;
      };
      exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
        if (!VersionCheck.isValid(version)) {
          throw new Error("Invalid QR Code version");
        }
        if (typeof mode === "undefined") mode = Mode.BYTE;
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (mode === Mode.MIXED) return dataTotalCodewordsBits;
        const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
        switch (mode) {
          case Mode.NUMERIC:
            return Math.floor(usableBits / 10 * 3);
          case Mode.ALPHANUMERIC:
            return Math.floor(usableBits / 11 * 2);
          case Mode.KANJI:
            return Math.floor(usableBits / 13);
          case Mode.BYTE:
          default:
            return Math.floor(usableBits / 8);
        }
      };
      exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
        let seg;
        const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
        if (Array.isArray(data)) {
          if (data.length > 1) {
            return getBestVersionForMixedData(data, ecl);
          }
          if (data.length === 0) {
            return 1;
          }
          seg = data[0];
        } else {
          seg = data;
        }
        return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
      };
      exports.getEncodedBits = function getEncodedBits(version) {
        if (!VersionCheck.isValid(version) || version < 7) {
          throw new Error("Invalid QR Code version");
        }
        let d = version << 12;
        while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
          d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
        }
        return version << 12 | d;
      };
    }
  });

  // node_modules/qrcode/lib/core/format-info.js
  var require_format_info = __commonJS({
    "node_modules/qrcode/lib/core/format-info.js"(exports) {
      var Utils = require_utils();
      var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
      var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
      var G15_BCH = Utils.getBCHDigit(G15);
      exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
        const data = errorCorrectionLevel.bit << 3 | mask;
        let d = data << 10;
        while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
          d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
        }
        return (data << 10 | d) ^ G15_MASK;
      };
    }
  });

  // node_modules/qrcode/lib/core/numeric-data.js
  var require_numeric_data = __commonJS({
    "node_modules/qrcode/lib/core/numeric-data.js"(exports, module) {
      var Mode = require_mode();
      function NumericData(data) {
        this.mode = Mode.NUMERIC;
        this.data = data.toString();
      }
      NumericData.getBitsLength = function getBitsLength(length) {
        return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
      };
      NumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      NumericData.prototype.getBitsLength = function getBitsLength() {
        return NumericData.getBitsLength(this.data.length);
      };
      NumericData.prototype.write = function write(bitBuffer) {
        let i, group, value;
        for (i = 0; i + 3 <= this.data.length; i += 3) {
          group = this.data.substr(i, 3);
          value = parseInt(group, 10);
          bitBuffer.put(value, 10);
        }
        const remainingNum = this.data.length - i;
        if (remainingNum > 0) {
          group = this.data.substr(i);
          value = parseInt(group, 10);
          bitBuffer.put(value, remainingNum * 3 + 1);
        }
      };
      module.exports = NumericData;
    }
  });

  // node_modules/qrcode/lib/core/alphanumeric-data.js
  var require_alphanumeric_data = __commonJS({
    "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports, module) {
      var Mode = require_mode();
      var ALPHA_NUM_CHARS = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
        "Q",
        "R",
        "S",
        "T",
        "U",
        "V",
        "W",
        "X",
        "Y",
        "Z",
        " ",
        "$",
        "%",
        "*",
        "+",
        "-",
        ".",
        "/",
        ":"
      ];
      function AlphanumericData(data) {
        this.mode = Mode.ALPHANUMERIC;
        this.data = data;
      }
      AlphanumericData.getBitsLength = function getBitsLength(length) {
        return 11 * Math.floor(length / 2) + 6 * (length % 2);
      };
      AlphanumericData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      AlphanumericData.prototype.getBitsLength = function getBitsLength() {
        return AlphanumericData.getBitsLength(this.data.length);
      };
      AlphanumericData.prototype.write = function write(bitBuffer) {
        let i;
        for (i = 0; i + 2 <= this.data.length; i += 2) {
          let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
          value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
          bitBuffer.put(value, 11);
        }
        if (this.data.length % 2) {
          bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
        }
      };
      module.exports = AlphanumericData;
    }
  });

  // node_modules/qrcode/lib/core/byte-data.js
  var require_byte_data = __commonJS({
    "node_modules/qrcode/lib/core/byte-data.js"(exports, module) {
      var Mode = require_mode();
      function ByteData(data) {
        this.mode = Mode.BYTE;
        if (typeof data === "string") {
          this.data = new TextEncoder().encode(data);
        } else {
          this.data = new Uint8Array(data);
        }
      }
      ByteData.getBitsLength = function getBitsLength(length) {
        return length * 8;
      };
      ByteData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      ByteData.prototype.getBitsLength = function getBitsLength() {
        return ByteData.getBitsLength(this.data.length);
      };
      ByteData.prototype.write = function(bitBuffer) {
        for (let i = 0, l = this.data.length; i < l; i++) {
          bitBuffer.put(this.data[i], 8);
        }
      };
      module.exports = ByteData;
    }
  });

  // node_modules/qrcode/lib/core/kanji-data.js
  var require_kanji_data = __commonJS({
    "node_modules/qrcode/lib/core/kanji-data.js"(exports, module) {
      var Mode = require_mode();
      var Utils = require_utils();
      function KanjiData(data) {
        this.mode = Mode.KANJI;
        this.data = data;
      }
      KanjiData.getBitsLength = function getBitsLength(length) {
        return length * 13;
      };
      KanjiData.prototype.getLength = function getLength() {
        return this.data.length;
      };
      KanjiData.prototype.getBitsLength = function getBitsLength() {
        return KanjiData.getBitsLength(this.data.length);
      };
      KanjiData.prototype.write = function(bitBuffer) {
        let i;
        for (i = 0; i < this.data.length; i++) {
          let value = Utils.toSJIS(this.data[i]);
          if (value >= 33088 && value <= 40956) {
            value -= 33088;
          } else if (value >= 57408 && value <= 60351) {
            value -= 49472;
          } else {
            throw new Error(
              "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
            );
          }
          value = (value >>> 8 & 255) * 192 + (value & 255);
          bitBuffer.put(value, 13);
        }
      };
      module.exports = KanjiData;
    }
  });

  // node_modules/dijkstrajs/dijkstra.js
  var require_dijkstra = __commonJS({
    "node_modules/dijkstrajs/dijkstra.js"(exports, module) {
      "use strict";
      var dijkstra = {
        single_source_shortest_paths: function(graph, s, d) {
          var predecessors = {};
          var costs = {};
          costs[s] = 0;
          var open = dijkstra.PriorityQueue.make();
          open.push(s, 0);
          var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
          while (!open.empty()) {
            closest = open.pop();
            u = closest.value;
            cost_of_s_to_u = closest.cost;
            adjacent_nodes = graph[u] || {};
            for (v in adjacent_nodes) {
              if (adjacent_nodes.hasOwnProperty(v)) {
                cost_of_e = adjacent_nodes[v];
                cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
                cost_of_s_to_v = costs[v];
                first_visit = typeof costs[v] === "undefined";
                if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                  costs[v] = cost_of_s_to_u_plus_cost_of_e;
                  open.push(v, cost_of_s_to_u_plus_cost_of_e);
                  predecessors[v] = u;
                }
              }
            }
          }
          if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
            var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
            throw new Error(msg);
          }
          return predecessors;
        },
        extract_shortest_path_from_predecessor_list: function(predecessors, d) {
          var nodes = [];
          var u = d;
          var predecessor;
          while (u) {
            nodes.push(u);
            predecessor = predecessors[u];
            u = predecessors[u];
          }
          nodes.reverse();
          return nodes;
        },
        find_path: function(graph, s, d) {
          var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
          return dijkstra.extract_shortest_path_from_predecessor_list(
            predecessors,
            d
          );
        },
        /**
         * A very naive priority queue implementation.
         */
        PriorityQueue: {
          make: function(opts) {
            var T = dijkstra.PriorityQueue, t2 = {}, key;
            opts = opts || {};
            for (key in T) {
              if (T.hasOwnProperty(key)) {
                t2[key] = T[key];
              }
            }
            t2.queue = [];
            t2.sorter = opts.sorter || T.default_sorter;
            return t2;
          },
          default_sorter: function(a, b) {
            return a.cost - b.cost;
          },
          /**
           * Add a new item to the queue and ensure the highest priority element
           * is at the front of the queue.
           */
          push: function(value, cost) {
            var item = { value, cost };
            this.queue.push(item);
            this.queue.sort(this.sorter);
          },
          /**
           * Return the highest priority element in the queue.
           */
          pop: function() {
            return this.queue.shift();
          },
          empty: function() {
            return this.queue.length === 0;
          }
        }
      };
      if (typeof module !== "undefined") {
        module.exports = dijkstra;
      }
    }
  });

  // node_modules/qrcode/lib/core/segments.js
  var require_segments = __commonJS({
    "node_modules/qrcode/lib/core/segments.js"(exports) {
      var Mode = require_mode();
      var NumericData = require_numeric_data();
      var AlphanumericData = require_alphanumeric_data();
      var ByteData = require_byte_data();
      var KanjiData = require_kanji_data();
      var Regex = require_regex();
      var Utils = require_utils();
      var dijkstra = require_dijkstra();
      function getStringByteLength(str) {
        return unescape(encodeURIComponent(str)).length;
      }
      function getSegments(regex, mode, str) {
        const segments = [];
        let result;
        while ((result = regex.exec(str)) !== null) {
          segments.push({
            data: result[0],
            index: result.index,
            mode,
            length: result[0].length
          });
        }
        return segments;
      }
      function getSegmentsFromString(dataStr) {
        const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
        const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
        let byteSegs;
        let kanjiSegs;
        if (Utils.isKanjiModeEnabled()) {
          byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
          kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
        } else {
          byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
          kanjiSegs = [];
        }
        const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
        return segs.sort(function(s1, s2) {
          return s1.index - s2.index;
        }).map(function(obj) {
          return {
            data: obj.data,
            mode: obj.mode,
            length: obj.length
          };
        });
      }
      function getSegmentBitsLength(length, mode) {
        switch (mode) {
          case Mode.NUMERIC:
            return NumericData.getBitsLength(length);
          case Mode.ALPHANUMERIC:
            return AlphanumericData.getBitsLength(length);
          case Mode.KANJI:
            return KanjiData.getBitsLength(length);
          case Mode.BYTE:
            return ByteData.getBitsLength(length);
        }
      }
      function mergeSegments(segs) {
        return segs.reduce(function(acc, curr) {
          const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
          if (prevSeg && prevSeg.mode === curr.mode) {
            acc[acc.length - 1].data += curr.data;
            return acc;
          }
          acc.push(curr);
          return acc;
        }, []);
      }
      function buildNodes(segs) {
        const nodes = [];
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          switch (seg.mode) {
            case Mode.NUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.ALPHANUMERIC:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: seg.length }
              ]);
              break;
            case Mode.KANJI:
              nodes.push([
                seg,
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
              break;
            case Mode.BYTE:
              nodes.push([
                { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
              ]);
          }
        }
        return nodes;
      }
      function buildGraph(nodes, version) {
        const table = {};
        const graph = { start: {} };
        let prevNodeIds = ["start"];
        for (let i = 0; i < nodes.length; i++) {
          const nodeGroup = nodes[i];
          const currentNodeIds = [];
          for (let j = 0; j < nodeGroup.length; j++) {
            const node = nodeGroup[j];
            const key = "" + i + j;
            currentNodeIds.push(key);
            table[key] = { node, lastCount: 0 };
            graph[key] = {};
            for (let n = 0; n < prevNodeIds.length; n++) {
              const prevNodeId = prevNodeIds[n];
              if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
                graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
                table[prevNodeId].lastCount += node.length;
              } else {
                if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
                graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
              }
            }
          }
          prevNodeIds = currentNodeIds;
        }
        for (let n = 0; n < prevNodeIds.length; n++) {
          graph[prevNodeIds[n]].end = 0;
        }
        return { map: graph, table };
      }
      function buildSingleSegment(data, modesHint) {
        let mode;
        const bestMode = Mode.getBestModeForData(data);
        mode = Mode.from(modesHint, bestMode);
        if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
          throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
        }
        if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
          mode = Mode.BYTE;
        }
        switch (mode) {
          case Mode.NUMERIC:
            return new NumericData(data);
          case Mode.ALPHANUMERIC:
            return new AlphanumericData(data);
          case Mode.KANJI:
            return new KanjiData(data);
          case Mode.BYTE:
            return new ByteData(data);
        }
      }
      exports.fromArray = function fromArray(array) {
        return array.reduce(function(acc, seg) {
          if (typeof seg === "string") {
            acc.push(buildSingleSegment(seg, null));
          } else if (seg.data) {
            acc.push(buildSingleSegment(seg.data, seg.mode));
          }
          return acc;
        }, []);
      };
      exports.fromString = function fromString(data, version) {
        const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
        const nodes = buildNodes(segs);
        const graph = buildGraph(nodes, version);
        const path = dijkstra.find_path(graph.map, "start", "end");
        const optimizedSegs = [];
        for (let i = 1; i < path.length - 1; i++) {
          optimizedSegs.push(graph.table[path[i]].node);
        }
        return exports.fromArray(mergeSegments(optimizedSegs));
      };
      exports.rawSplit = function rawSplit(data) {
        return exports.fromArray(
          getSegmentsFromString(data, Utils.isKanjiModeEnabled())
        );
      };
    }
  });

  // node_modules/qrcode/lib/core/qrcode.js
  var require_qrcode = __commonJS({
    "node_modules/qrcode/lib/core/qrcode.js"(exports) {
      var Utils = require_utils();
      var ECLevel = require_error_correction_level();
      var BitBuffer = require_bit_buffer();
      var BitMatrix = require_bit_matrix();
      var AlignmentPattern = require_alignment_pattern();
      var FinderPattern = require_finder_pattern();
      var MaskPattern = require_mask_pattern();
      var ECCode = require_error_correction_code();
      var ReedSolomonEncoder = require_reed_solomon_encoder();
      var Version = require_version();
      var FormatInfo = require_format_info();
      var Mode = require_mode();
      var Segments = require_segments();
      function setupFinderPattern(matrix, version) {
        const size = matrix.size;
        const pos = FinderPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || size <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c <= -1 || size <= col + c) continue;
              if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupTimingPattern(matrix) {
        const size = matrix.size;
        for (let r = 8; r < size - 8; r++) {
          const value = r % 2 === 0;
          matrix.set(r, 6, value, true);
          matrix.set(6, r, value, true);
        }
      }
      function setupAlignmentPattern(matrix, version) {
        const pos = AlignmentPattern.getPositions(version);
        for (let i = 0; i < pos.length; i++) {
          const row = pos[i][0];
          const col = pos[i][1];
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
                matrix.set(row + r, col + c, true, true);
              } else {
                matrix.set(row + r, col + c, false, true);
              }
            }
          }
        }
      }
      function setupVersionInfo(matrix, version) {
        const size = matrix.size;
        const bits = Version.getEncodedBits(version);
        let row, col, mod;
        for (let i = 0; i < 18; i++) {
          row = Math.floor(i / 3);
          col = i % 3 + size - 8 - 3;
          mod = (bits >> i & 1) === 1;
          matrix.set(row, col, mod, true);
          matrix.set(col, row, mod, true);
        }
      }
      function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
        const size = matrix.size;
        const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
        let i, mod;
        for (i = 0; i < 15; i++) {
          mod = (bits >> i & 1) === 1;
          if (i < 6) {
            matrix.set(i, 8, mod, true);
          } else if (i < 8) {
            matrix.set(i + 1, 8, mod, true);
          } else {
            matrix.set(size - 15 + i, 8, mod, true);
          }
          if (i < 8) {
            matrix.set(8, size - i - 1, mod, true);
          } else if (i < 9) {
            matrix.set(8, 15 - i - 1 + 1, mod, true);
          } else {
            matrix.set(8, 15 - i - 1, mod, true);
          }
        }
        matrix.set(size - 8, 8, 1, true);
      }
      function setupData(matrix, data) {
        const size = matrix.size;
        let inc = -1;
        let row = size - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (!matrix.isReserved(row, col - c)) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = (data[byteIndex] >>> bitIndex & 1) === 1;
                }
                matrix.set(row, col - c, dark);
                bitIndex--;
                if (bitIndex === -1) {
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || size <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      }
      function createData(version, errorCorrectionLevel, segments) {
        const buffer = new BitBuffer();
        segments.forEach(function(data) {
          buffer.put(data.mode.bit, 4);
          buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
          data.write(buffer);
        });
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
        if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
          buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 !== 0) {
          buffer.putBit(0);
        }
        const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
        for (let i = 0; i < remainingByte; i++) {
          buffer.put(i % 2 ? 17 : 236, 8);
        }
        return createCodewords(buffer, version, errorCorrectionLevel);
      }
      function createCodewords(bitBuffer, version, errorCorrectionLevel) {
        const totalCodewords = Utils.getSymbolTotalCodewords(version);
        const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
        const dataTotalCodewords = totalCodewords - ecTotalCodewords;
        const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
        const blocksInGroup2 = totalCodewords % ecTotalBlocks;
        const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
        const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
        const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
        const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
        const rs = new ReedSolomonEncoder(ecCount);
        let offset = 0;
        const dcData = new Array(ecTotalBlocks);
        const ecData = new Array(ecTotalBlocks);
        let maxDataSize = 0;
        const buffer = new Uint8Array(bitBuffer.buffer);
        for (let b = 0; b < ecTotalBlocks; b++) {
          const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
          dcData[b] = buffer.slice(offset, offset + dataSize);
          ecData[b] = rs.encode(dcData[b]);
          offset += dataSize;
          maxDataSize = Math.max(maxDataSize, dataSize);
        }
        const data = new Uint8Array(totalCodewords);
        let index = 0;
        let i, r;
        for (i = 0; i < maxDataSize; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            if (i < dcData[r].length) {
              data[index++] = dcData[r][i];
            }
          }
        }
        for (i = 0; i < ecCount; i++) {
          for (r = 0; r < ecTotalBlocks; r++) {
            data[index++] = ecData[r][i];
          }
        }
        return data;
      }
      function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
        let segments;
        if (Array.isArray(data)) {
          segments = Segments.fromArray(data);
        } else if (typeof data === "string") {
          let estimatedVersion = version;
          if (!estimatedVersion) {
            const rawSegments = Segments.rawSplit(data);
            estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
          }
          segments = Segments.fromString(data, estimatedVersion || 40);
        } else {
          throw new Error("Invalid data");
        }
        const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
        if (!bestVersion) {
          throw new Error("The amount of data is too big to be stored in a QR Code");
        }
        if (!version) {
          version = bestVersion;
        } else if (version < bestVersion) {
          throw new Error(
            "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
          );
        }
        const dataBits = createData(version, errorCorrectionLevel, segments);
        const moduleCount = Utils.getSymbolSize(version);
        const modules = new BitMatrix(moduleCount);
        setupFinderPattern(modules, version);
        setupTimingPattern(modules);
        setupAlignmentPattern(modules, version);
        setupFormatInfo(modules, errorCorrectionLevel, 0);
        if (version >= 7) {
          setupVersionInfo(modules, version);
        }
        setupData(modules, dataBits);
        if (isNaN(maskPattern)) {
          maskPattern = MaskPattern.getBestMask(
            modules,
            setupFormatInfo.bind(null, modules, errorCorrectionLevel)
          );
        }
        MaskPattern.applyMask(maskPattern, modules);
        setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
        return {
          modules,
          version,
          errorCorrectionLevel,
          maskPattern,
          segments
        };
      }
      exports.create = function create(data, options) {
        if (typeof data === "undefined" || data === "") {
          throw new Error("No input text");
        }
        let errorCorrectionLevel = ECLevel.M;
        let version;
        let mask;
        if (typeof options !== "undefined") {
          errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
          version = Version.from(options.version);
          mask = MaskPattern.from(options.maskPattern);
          if (options.toSJISFunc) {
            Utils.setToSJISFunction(options.toSJISFunc);
          }
        }
        return createSymbol(data, version, errorCorrectionLevel, mask);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/utils.js
  var require_utils2 = __commonJS({
    "node_modules/qrcode/lib/renderer/utils.js"(exports) {
      function hex2rgba(hex) {
        if (typeof hex === "number") {
          hex = hex.toString();
        }
        if (typeof hex !== "string") {
          throw new Error("Color should be defined as hex string");
        }
        let hexCode = hex.slice().replace("#", "").split("");
        if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
          throw new Error("Invalid hex color: " + hex);
        }
        if (hexCode.length === 3 || hexCode.length === 4) {
          hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
            return [c, c];
          }));
        }
        if (hexCode.length === 6) hexCode.push("F", "F");
        const hexValue = parseInt(hexCode.join(""), 16);
        return {
          r: hexValue >> 24 & 255,
          g: hexValue >> 16 & 255,
          b: hexValue >> 8 & 255,
          a: hexValue & 255,
          hex: "#" + hexCode.slice(0, 6).join("")
        };
      }
      exports.getOptions = function getOptions(options) {
        if (!options) options = {};
        if (!options.color) options.color = {};
        const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
        const width = options.width && options.width >= 21 ? options.width : void 0;
        const scale = options.scale || 4;
        return {
          width,
          scale: width ? 4 : scale,
          margin,
          color: {
            dark: hex2rgba(options.color.dark || "#000000ff"),
            light: hex2rgba(options.color.light || "#ffffffff")
          },
          type: options.type,
          rendererOpts: options.rendererOpts || {}
        };
      };
      exports.getScale = function getScale(qrSize, opts) {
        return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
      };
      exports.getImageWidth = function getImageWidth(qrSize, opts) {
        const scale = exports.getScale(qrSize, opts);
        return Math.floor((qrSize + opts.margin * 2) * scale);
      };
      exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
        const size = qr.modules.size;
        const data = qr.modules.data;
        const scale = exports.getScale(size, opts);
        const symbolSize = Math.floor((size + opts.margin * 2) * scale);
        const scaledMargin = opts.margin * scale;
        const palette = [opts.color.light, opts.color.dark];
        for (let i = 0; i < symbolSize; i++) {
          for (let j = 0; j < symbolSize; j++) {
            let posDst = (i * symbolSize + j) * 4;
            let pxColor = opts.color.light;
            if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
              const iSrc = Math.floor((i - scaledMargin) / scale);
              const jSrc = Math.floor((j - scaledMargin) / scale);
              pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
            }
            imgData[posDst++] = pxColor.r;
            imgData[posDst++] = pxColor.g;
            imgData[posDst++] = pxColor.b;
            imgData[posDst] = pxColor.a;
          }
        }
      };
    }
  });

  // node_modules/qrcode/lib/renderer/canvas.js
  var require_canvas = __commonJS({
    "node_modules/qrcode/lib/renderer/canvas.js"(exports) {
      var Utils = require_utils2();
      function clearCanvas(ctx, canvas, size) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!canvas.style) canvas.style = {};
        canvas.height = size;
        canvas.width = size;
        canvas.style.height = size + "px";
        canvas.style.width = size + "px";
      }
      function getCanvasElement() {
        try {
          return document.createElement("canvas");
        } catch (e) {
          throw new Error("You need to specify a canvas element");
        }
      }
      exports.render = function render(qrData, canvas, options) {
        let opts = options;
        let canvasEl = canvas;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!canvas) {
          canvasEl = getCanvasElement();
        }
        opts = Utils.getOptions(opts);
        const size = Utils.getImageWidth(qrData.modules.size, opts);
        const ctx = canvasEl.getContext("2d");
        const image = ctx.createImageData(size, size);
        Utils.qrToImageData(image.data, qrData, opts);
        clearCanvas(ctx, canvasEl, size);
        ctx.putImageData(image, 0, 0);
        return canvasEl;
      };
      exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
        let opts = options;
        if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
          opts = canvas;
          canvas = void 0;
        }
        if (!opts) opts = {};
        const canvasEl = exports.render(qrData, canvas, opts);
        const type = opts.type || "image/png";
        const rendererOpts = opts.rendererOpts || {};
        return canvasEl.toDataURL(type, rendererOpts.quality);
      };
    }
  });

  // node_modules/qrcode/lib/renderer/svg-tag.js
  var require_svg_tag = __commonJS({
    "node_modules/qrcode/lib/renderer/svg-tag.js"(exports) {
      var Utils = require_utils2();
      function getColorAttrib(color, attrib) {
        const alpha = color.a / 255;
        const str = attrib + '="' + color.hex + '"';
        return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
      }
      function svgCmd(cmd, x, y) {
        let str = cmd + x;
        if (typeof y !== "undefined") str += " " + y;
        return str;
      }
      function qrToPath(data, size, margin) {
        let path = "";
        let moveBy = 0;
        let newRow = false;
        let lineLength = 0;
        for (let i = 0; i < data.length; i++) {
          const col = Math.floor(i % size);
          const row = Math.floor(i / size);
          if (!col && !newRow) newRow = true;
          if (data[i]) {
            lineLength++;
            if (!(i > 0 && col > 0 && data[i - 1])) {
              path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
              moveBy = 0;
              newRow = false;
            }
            if (!(col + 1 < size && data[i + 1])) {
              path += svgCmd("h", lineLength);
              lineLength = 0;
            }
          } else {
            moveBy++;
          }
        }
        return path;
      }
      exports.render = function render(qrData, options, cb) {
        const opts = Utils.getOptions(options);
        const size = qrData.modules.size;
        const data = qrData.modules.data;
        const qrcodesize = size + opts.margin * 2;
        const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
        const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
        const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
        const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
        const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + "</svg>\n";
        if (typeof cb === "function") {
          cb(null, svgTag);
        }
        return svgTag;
      };
    }
  });

  // node_modules/qrcode/lib/browser.js
  var require_browser = __commonJS({
    "node_modules/qrcode/lib/browser.js"(exports) {
      var canPromise = require_can_promise();
      var QRCode2 = require_qrcode();
      var CanvasRenderer = require_canvas();
      var SvgRenderer = require_svg_tag();
      function renderCanvas(renderFunc, canvas, text, opts, cb) {
        const args = [].slice.call(arguments, 1);
        const argsNum = args.length;
        const isLastArgCb = typeof args[argsNum - 1] === "function";
        if (!isLastArgCb && !canPromise()) {
          throw new Error("Callback required as last argument");
        }
        if (isLastArgCb) {
          if (argsNum < 2) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 2) {
            cb = text;
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 3) {
            if (canvas.getContext && typeof cb === "undefined") {
              cb = opts;
              opts = void 0;
            } else {
              cb = opts;
              opts = text;
              text = canvas;
              canvas = void 0;
            }
          }
        } else {
          if (argsNum < 1) {
            throw new Error("Too few arguments provided");
          }
          if (argsNum === 1) {
            text = canvas;
            canvas = opts = void 0;
          } else if (argsNum === 2 && !canvas.getContext) {
            opts = text;
            text = canvas;
            canvas = void 0;
          }
          return new Promise(function(resolve, reject) {
            try {
              const data = QRCode2.create(text, opts);
              resolve(renderFunc(data, canvas, opts));
            } catch (e) {
              reject(e);
            }
          });
        }
        try {
          const data = QRCode2.create(text, opts);
          cb(null, renderFunc(data, canvas, opts));
        } catch (e) {
          cb(e);
        }
      }
      exports.create = QRCode2.create;
      exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
      exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
      exports.toString = renderCanvas.bind(null, function(data, _, opts) {
        return SvgRenderer.render(data, opts);
      });
    }
  });

  // src/i18n.js
  var dict = {
    tr: {
      "x.timeout": "5 saniye i\xE7inde dene",
      "app.start": "Sohbete ba\u015Fla",
      "app.busy": "Adres olu\u015Fturuluyor\u2026",
      "app.headline": "Sessiz sohbete ba\u015Fla",
      "app.lede": "Sunucusuz, kay\u0131ts\u0131z ve izsiz. Anahtarlar yaln\u0131zca bellekte \xFCretilir; bu cihaz\u0131n diski hi\xE7 yaz\u0131lmaz.",
      "app.addrNote": "Konu\u015Fmak i\xE7in arkada\u015F\u0131na ba\u011Flant\u0131 kodu g\xF6ndermen yeterli \u2014 kimli\u011Fini payla\u015Fma.",
      "app.footnote": "Anahtarlar yaln\u0131zca bellekte tutulur; kapat\u0131nca ba\u011Flant\u0131lar biter, iz kalmaz.",
      "net.summary": "A\u011F ayarlar\u0131 (geli\u015Fmi\u015F)",
      "net.hostLabel": "Sinyal sunucusu (opsiyonel)",
      "net.hostPh": "\xF6rn. peer.ornek.com",
      "net.portLabel": "Port",
      "net.pathLabel": "Yol",
      "net.iceLabel": "ICE/TURN sunucular\u0131 (JSON)",
      "net.help": "Bo\u015F b\u0131rak\u0131l\u0131rsa PeerJS genel bulutu + Google STUN kullan\u0131l\u0131r. Kendi TURN'unu eklemek simetrik NAT'ta ba\u011Flant\u0131y\u0131 garanti eder.",
      "status.offline": "\xE7evrimd\u0131\u015F\u0131",
      "status.online": "yay\u0131nda",
      "status.verified": "do\u011Frulanm\u0131\u015F",
      "status.connecting": "kuruluyor\u2026",
      "status.error": "hata",
      "status.chatPrefix": "ba\u011Fl\u0131 \xB7 ",
      "panic.label": "Panik",
      "panic.title": "M\xFCh\xFCr\xFC k\u0131r, masay\u0131 bo\u015Falt",
      "ident.label": "Kimli\u011Fim",
      "ident.reset": "Kimli\u011Fi s\u0131f\u0131rla",
      "tab.connect": "Ba\u011Flan",
      "tab.code": "Kod",
      "tab.chat": "Sohbet",
      "connect.title": "Ba\u011Flan",
      "connect.sub": 'Arkada\u015F\u0131n\u0131n "Kod" sekmesinde \xFCretti\u011Fi ba\u011Flant\u0131 kodunu yap\u0131\u015Ft\u0131r \u2014 rastgele harf/rakam dizisi. (Kendi "Kimli\u011Fin" de\u011Fil.)',
      "connect.ph": "Arkada\u015F\u0131n\u0131n g\xF6nderdi\u011Fi kodu yap\u0131\u015Ft\u0131r\u2026",
      "connect.btn": "Ba\u011Flant\u0131 kur",
      "connect.scan": "Kodu tara",
      "connect.safety": "Ba\u011Flant\u0131 kurulunca g\xFCvenlik numaras\u0131n\u0131 kar\u015F\u0131 cihazdakiyle kar\u015F\u0131la\u015Ft\u0131r. Do\u011Frulanana kadar mesaj g\xF6nderilemez.",
      "connect.book": "Adres defteri",
      "connect.busy": "Kuruluyor\u2026",
      "theme.label": "Tema",
      "theme.bone": "Kemik-beyaz\u0131",
      "theme.dark": "Karanl\u0131k",
      "theme.hc": "Y\xFCksek kontrast",
      "theme.system": "Sistem",
      "lang.label": "Dil",
      "code.title": "Ba\u011Flant\u0131 kodu",
      "code.sub": "\xDCretilen kod rastgele g\xF6r\xFCn\xFCml\xFC bir dizedir \u2014 Kimli\u011Fin (adresin) bu kodun i\xE7inde g\xF6m\xFCl\xFCd\xFCr. Kodu g\xFCvenilir bir kanaldan g\xF6nder; tek kullan\u0131ml\u0131kt\u0131r.",
      "code.your": "Kodun",
      "code.copy": "Kopyala",
      "code.copied": "Kopyaland\u0131",
      "code.expired": "Kodun s\xFCresi doldu \u2014 yeni kod \xFCret.",
      "code.validFor": "Kodun ge\xE7erlili\u011Fi: ",
      "code.gen": "Yeni kod \xFCret",
      "code.footnote": "Bu, t\xFCm kodun kopyaland\u0131\u011F\u0131ndan emin ol; ba\u015Ftan ve sondan harf eksiltme kodu bozar.",
      "code.qrNote": "Bu kodu yaln\u0131zca g\xFCvendi\u011Fin ki\u015Fiye g\xF6ster.",
      "scan.stamp": "Kodu \xE7er\xE7eveye getir",
      "scan.cancel": "Vazge\xE7",
      "chat.empty": "Hen\xFCz mesaj yok. Ba\u011Flant\u0131 ba\u015Fka bir pencereden kurulunca buraya m\xFCh\xFCrl\xFC teslimatlar d\xFC\u015Fer.",
      "chat.typing": "yaz\u0131yor\u2026",
      "chat.peer": "Sohbet",
      "chat.timerTitle": "Sohbet d\xFCzeyi otomatik yok etme",
      "chat.timerOff": "Yok etme yok",
      "chat.timer30": "30 sn",
      "chat.timer300": "5 dk",
      "chat.expiryOff": "S\xFCre yok",
      "chat.expiry30": "30 sn sonra yok ol",
      "chat.expiry300": "5 dk sonra yok ol",
      "chat.fileBtn": "Dosya g\xF6nder",
      "chat.ph": "\u015Eifreli mesaj\u2026",
      "chat.send": "G\xF6nder",
      "chat.recMic": "Sesli mesaj",
      "voice.record": "Kaydet",
      "voice.recording": "kay\u0131t\u2026",
      "voice.stop": "Dur",
      "voice.cancel": "Vazge\xE7",
      "voice.send": "G\xF6nder",
      "voice.play": "Oynat",
      "voice.pause": "Duraklat",
      "voice.ready": "Ses kayd\u0131 haz\u0131r",
      "voice.sent": "Sesli mesaj g\xF6nderildi",
      "voice.countdown": "kay\u0131t",
      "call.audio": "Sesli arama",
      "call.video": "G\xF6r\xFCnt\xFCl\xFC arama",
      "call.calling": "\xE7a\u011Fr\u0131l\u0131yor\u2026",
      "call.ringing": "gelen arama",
      "call.accept": "Kabul et",
      "call.reject": "Reddet",
      "call.end": "Bitir",
      "call.mute": "Mikrofon kapat",
      "call.unmute": "Mikrofon a\xE7",
      "call.videoOn": "Kamera a\xE7\u0131k",
      "call.videoOff": "Kamera kapal\u0131",
      "call.endedNote": "Arama sona erdi",
      "call.activeNote": "G\xF6r\xFC\u015Fme s\xFCr\xFCyor",
      "call.unsupported": "Taray\u0131c\u0131da WebRTC aramas\u0131 desteklenmiyor",
      "err.micDenied": "Mikrofon izni verilmedi",
      "err.voiceFailed": "Ses kayd\u0131 ba\u015Flat\u0131lamad\u0131",
      "err.voiceSendFailed": "Sesli mesaj g\xF6nderilemedi",
      "err.callStartFailed": "Arama ba\u015Flat\u0131lamad\u0131",
      "err.callBlocked": "Do\u011Frulanmam\u0131\u015F e\u015F \u2014 arama engellendi",
      "err.callBadSignal": "Ge\xE7ersiz arama sinyali",
      "error.emptyVoice": "Bo\u015F ses kayd\u0131 g\xF6nderilemez",
      "error.voiceTooLarge": "Ses kayd\u0131 \xE7ok b\xFCy\xFCk (en fazla 8 MB)",
      "error.callActive": "Zaten aktif bir arama var",
      "error.callBadSignal": "Ge\xE7ersiz arama sinyali",
      "chat.secure": "G\xFCvenli ba\u011Flant\u0131 kuruldu.",
      "chat.readOn": "Okundu a\xE7\u0131k",
      "chat.readOff": "Okundu kapal\u0131",
      "chat.readTitle": "Okundu ka\u015Fesi",
      "chat.readTitleOff": "Okundu ka\u015Fesi kapal\u0131",
      "menu.local": "Yerel sil",
      "menu.remote": "Kar\u015F\u0131 taraftan da sil",
      "menu.expired": "Silme s\xFCresi doldu (5 dakika)",
      "chat.recalled": "Bu mesaj geri \xE7ekildi",
      "chat.deletedRemote": "Kar\u015F\u0131 tarafta da silindi",
      "file.accept": "Al",
      "file.decline": "Reddet",
      "file.view": "G\xF6r\xFCnt\xFCle",
      "file.sent": "G\xF6nderildi",
      "file.complete": "Dosya tamamland\u0131",
      "file.declined": "Kar\u015F\u0131 taraf reddetti",
      "fp.title": "G\xFCvenlik numaras\u0131",
      "fp.sub": "Ba\u011F\u0131ms\u0131z bir kanaldan kar\u015F\u0131la\u015Ft\u0131r; e\u015Fle\u015Fiyorsa ba\u011Flant\u0131 g\xFCvenilir.",
      "fp.match": "Numaralar e\u015Fle\u015Fiyor",
      "fp.mismatch": "E\u015Fle\u015Fmiyor",
      "fp.verified": "Ba\u011Flant\u0131 do\u011Fruland\u0131",
      "fp.mismatchEnded": "E\u015Fle\u015Fmiyor \u2014 ba\u011Flant\u0131 sonland\u0131r\u0131ld\u0131. Yeni kod \xFCretip yeniden ba\u011Flan.",
      "reset.title": "Kimli\u011Fi s\u0131f\u0131rla",
      "reset.text": "Yeni kimlik olu\u015Fturulacak. T\xFCm ba\u011Flant\u0131lar kapanacak, oturumlar ve sohbet ge\xE7mi\u015Fi silinecek. Bu i\u015Flem geri al\u0131namaz.",
      "reset.cancel": "Vazge\xE7",
      "reset.confirm": "S\u0131f\u0131rla",
      "decoy.title": "Hava Durumu \u2014 Bug\xFCn",
      "decoy.note": "\u0130stanbul \xB7 18\xB0C \xB7 Par\xE7al\u0131 bulutlu",
      "decoy.restart": "Uygulamay\u0131 yeniden ba\u015Flat",
      "contact.new": "yeni",
      "contact.verified": "do\u011Frulanm\u0131\u015F",
      "err.noCode": "Ba\u011Flant\u0131 kodu girilmedi",
      "err.isAddress": 'Bu bir "Kimli\u011Fim" (adres), ba\u011Flant\u0131 kodu de\u011Fil. Arkada\u015F\u0131ndan "Kod" sekmesinde \xFCretti\u011Fi ba\u011Flant\u0131 kodunu istemelisin.',
      "err.connectFailed": "Ba\u011Flant\u0131 kurulamad\u0131",
      "err.genFailed": "Kod \xFCretilemedi",
      "err.sendFailed": "G\xF6nderilemedi",
      "err.recallSent": "Geri \xE7ekme g\xF6nderildi",
      "err.recallFailed": "Silme g\xF6nderilemedi",
      "err.reconnectFailed": "Yeniden ba\u011Flan\u0131lamad\u0131",
      "err.initFailed": "Ba\u015Flat\u0131lamad\u0131",
      "err.resetFailed": "S\u0131f\u0131rlama ba\u015Far\u0131s\u0131z",
      "err.fileRecvFailed": "Dosya al\u0131namad\u0131",
      "err.fileRejectFailed": "Reddetme g\xF6nderilemedi",
      "err.fileSendFailed": "Dosya g\xF6nderilemedi",
      "err.fileRead": "Dosya okunamad\u0131: ",
      "err.openChatFirst": "\xD6nce bir sohbet a\xE7",
      "err.verificationFailed": "Do\u011Frulama i\u015Flenemedi",
      "err.connectionError": "Ba\u011Flant\u0131 hatas\u0131: ",
      "err.cameraDenied": "Kamera izni verilmedi \u2014 kodu elle girebilirsin.",
      "error.timeout": "5 saniye i\xE7inde dene",
      "error.noConnection": "\xD6nce bu ki\u015Fiyle ba\u011Flant\u0131 kurmal\u0131s\u0131n",
      "error.initFailed": "Adres al\u0131namad\u0131",
      "error.peerError": "Peer hatas\u0131",
      "error.notVerified": "G\xFCvenlik numaras\u0131 do\u011Frulanana kadar mesaj g\xF6nderilemez",
      "error.emptyMessage": "Bo\u015F mesaj g\xF6nderilemez",
      "error.messageTooLong": "Mesaj \xE7ok uzun",
      "error.emptyFile": "Bo\u015F dosya g\xF6nderilemez",
      "error.fileTooLarge": "Dosya \xE7ok b\xFCy\xFCk (en fazla 8 MB)",
      "error.fileTypeForbidden": "\u0130zin verilmeyen dosya t\xFCr\xFC",
      "error.fileNotFound": "Dosya bulunamad\u0131",
      "error.channelClosed": "Veri kanal\u0131 a\xE7\u0131k de\u011Fil",
      "error.recallUnauthorized": "Bu mesaj silmeye uygun de\u011Fil (yaln\u0131zca kendi g\xF6nderdi\u011Fin mesajlar\u0131 silebilirsin)",
      "error.recallExpired": "Silme s\xFCresi doldu (5 dakika)",
      "error.codeExpired": "Kodun s\xFCresi doldu veya ge\xE7ersiz",
      "error.identityChanged": "Kimlik de\u011Fi\u015Fti \u2014 g\xFCvenlik numaras\u0131n\u0131 do\u011Frula",
      "error.noPendingIdentity": "Bekleyen kimlik de\u011Fi\u015Fimi yok",
      "error.peerLimit": "E\u015Fzamanl\u0131 ba\u011Flant\u0131 s\u0131n\u0131r\u0131 a\u015F\u0131ld\u0131",
      "error.decryptFailed": "Mesaj \xE7\xF6z\xFClemedi: ",
      "error.codeEmpty": "Ba\u011Flant\u0131 kodu girilmedi",
      "error.codeIsAddress": 'Bu bir "Kimli\u011Fim" (adres), ba\u011Flant\u0131 kodu de\u011Fil. Arkada\u015F\u0131ndan "Kod" sekmesinde \xFCretti\u011Fi ba\u011Flant\u0131 kodunu istemelisin.',
      "error.codeInvalid": "Ge\xE7ersiz ba\u011Flant\u0131 kodu",
      "error.codeIncomplete": "Ba\u011Flant\u0131 kodu eksik alan i\xE7eriyor",
      "error.codecInvalid": "Ge\xE7ersiz ba\u011Flant\u0131 kodu",
      "error.resetFailed": "Yeniden kurulum ba\u015Far\u0131s\u0131z",
      "error.sendReadFailed": "Okundu onay\u0131 g\xF6nderilemedi"
    },
    en: {
      "x.timeout": "try again in 5 seconds",
      "app.start": "Start chatting",
      "app.busy": "Creating address\u2026",
      "app.headline": "Start a silent chat",
      "app.lede": "Serverless, accountless and traceless. Keys are generated in memory only; this device's disk is never written.",
      "app.addrNote": "To talk, just send your friend a connection code \u2014 never share your identity.",
      "app.footnote": "Keys live in memory only; close it and connections end, leaving no trace.",
      "net.summary": "Network settings (advanced)",
      "net.hostLabel": "Signaling server (optional)",
      "net.hostPh": "e.g. peer.example.com",
      "net.portLabel": "Port",
      "net.pathLabel": "Path",
      "net.iceLabel": "ICE/TURN servers (JSON)",
      "net.help": "Leave empty to use the PeerJS public cloud + Google STUN. Adding your own TURN guarantees connectivity behind symmetric NAT.",
      "status.offline": "offline",
      "status.online": "online",
      "status.verified": "verified",
      "status.connecting": "connecting\u2026",
      "status.error": "error",
      "status.chatPrefix": "connected \xB7 ",
      "panic.label": "Panic",
      "panic.title": "Break the seal, clear the desk",
      "ident.label": "My identity",
      "ident.reset": "Reset identity",
      "tab.connect": "Connect",
      "tab.code": "Code",
      "tab.chat": "Chat",
      "connect.title": "Connect",
      "connect.sub": 'Paste the connection code your friend generated in the "Code" tab \u2014 a random string of letters and digits. (Not your "My identity".)',
      "connect.ph": "Paste the code your friend sent\u2026",
      "connect.btn": "Connect",
      "connect.scan": "Scan code",
      "connect.safety": "Once connected, compare the security number with the other device. You cannot send messages until it is verified.",
      "connect.book": "Address book",
      "connect.busy": "Connecting\u2026",
      "theme.label": "Theme",
      "theme.bone": "Bone",
      "theme.dark": "Dark",
      "theme.hc": "High contrast",
      "theme.system": "System",
      "lang.label": "Language",
      "code.title": "Connection code",
      "code.sub": "The generated code looks like a random string \u2014 your identity (address) is embedded in it. Send it over a trusted channel; it's single-use.",
      "code.your": "Your code",
      "code.copy": "Copy",
      "code.copied": "Copied",
      "code.expired": "Your code expired \u2014 generate a new one.",
      "code.validFor": "Valid for: ",
      "code.gen": "Generate new code",
      "code.footnote": "Make sure you copy the whole code; dropping letters from the start or end breaks it.",
      "code.qrNote": "Show this code only to someone you trust.",
      "scan.stamp": "Bring the code into the frame",
      "scan.cancel": "Cancel",
      "chat.empty": "No messages yet. Sealed deliveries land here once a connection is opened from another window.",
      "chat.typing": "typing\u2026",
      "chat.peer": "Chat",
      "chat.timerTitle": "Chat-level auto-delete",
      "chat.timerOff": "No auto-delete",
      "chat.timer30": "30s",
      "chat.timer300": "5m",
      "chat.expiryOff": "No timer",
      "chat.expiry30": "Disappear in 30s",
      "chat.expiry300": "Disappear in 5m",
      "chat.fileBtn": "Send file",
      "chat.ph": "Encrypted message\u2026",
      "chat.send": "Send",
      "chat.recMic": "Voice message",
      "voice.record": "Record",
      "voice.recording": "recording\u2026",
      "voice.stop": "Stop",
      "voice.cancel": "Cancel",
      "voice.send": "Send",
      "voice.play": "Play",
      "voice.pause": "Pause",
      "voice.ready": "Voice recording ready",
      "voice.sent": "Voice message sent",
      "voice.countdown": "recording",
      "call.audio": "Voice call",
      "call.video": "Video call",
      "call.calling": "calling\u2026",
      "call.ringing": "incoming call",
      "call.accept": "Accept",
      "call.reject": "Decline",
      "call.end": "End",
      "call.mute": "Mute mic",
      "call.unmute": "Unmute",
      "call.videoOn": "Camera on",
      "call.videoOff": "Camera off",
      "call.endedNote": "Call ended",
      "call.activeNote": "Call in progress",
      "call.unsupported": "WebRTC calls not supported in this browser",
      "err.micDenied": "Microphone permission denied",
      "err.voiceFailed": "Could not start voice recording",
      "err.voiceSendFailed": "Could not send voice message",
      "err.callStartFailed": "Could not start the call",
      "err.callBlocked": "Unverified peer \u2014 call blocked",
      "err.callBadSignal": "Invalid call signal",
      "error.emptyVoice": "Cannot send an empty voice message",
      "error.voiceTooLarge": "Voice message too large (max 8 MB)",
      "error.callActive": "A call is already active",
      "error.callBadSignal": "Invalid call signal",
      "chat.secure": "Secure connection established.",
      "chat.readOn": "Read on",
      "chat.readOff": "Read off",
      "chat.readTitle": "Read receipt",
      "chat.readTitleOff": "Read receipt off",
      "menu.local": "Delete locally",
      "menu.remote": "Delete on the other side",
      "menu.expired": "Recall window expired (5 minutes)",
      "chat.recalled": "This message was recalled",
      "chat.deletedRemote": "Deleted on the other side",
      "file.accept": "Accept",
      "file.decline": "Decline",
      "file.view": "View",
      "file.sent": "Sent",
      "file.complete": "File complete",
      "file.declined": "The other side declined",
      "fp.title": "Security number",
      "fp.sub": "Compare over an independent channel; if they match, the connection is trustworthy.",
      "fp.match": "Numbers match",
      "fp.mismatch": "They don't match",
      "fp.verified": "Connection verified",
      "fp.mismatchEnded": "They don't match \u2014 connection ended. Generate a new code and reconnect.",
      "reset.title": "Reset identity",
      "reset.text": "A new identity will be created. All connections close and sessions and chat history are deleted. This cannot be undone.",
      "reset.cancel": "Cancel",
      "reset.confirm": "Reset",
      "decoy.title": "Weather \u2014 Today",
      "decoy.note": "Istanbul \xB7 18\xB0C \xB7 Partly cloudy",
      "decoy.restart": "Restart app",
      "contact.new": "new",
      "contact.verified": "verified",
      "err.noCode": "No connection code entered",
      "err.isAddress": 'This is a "My identity" (address), not a connection code. Ask your friend for the code from their "Code" tab.',
      "err.connectFailed": "Could not connect",
      "err.genFailed": "Could not generate code",
      "err.sendFailed": "Could not send",
      "err.recallSent": "Recall sent",
      "err.recallFailed": "Could not recall",
      "err.reconnectFailed": "Could not reconnect",
      "err.initFailed": "Could not initialize",
      "err.resetFailed": "Could not reset",
      "err.fileRecvFailed": "Could not accept file",
      "err.fileRejectFailed": "Could not decline",
      "err.fileSendFailed": "Could not send file",
      "err.fileRead": "Could not read file: ",
      "err.openChatFirst": "Open a chat first",
      "err.verificationFailed": "Could not process verification",
      "err.connectionError": "Connection error: ",
      "err.cameraDenied": "Camera permission denied \u2014 you can still enter the code by hand.",
      "error.timeout": "try again in 5 seconds",
      "error.noConnection": "You must connect with this person first",
      "error.initFailed": "Address unavailable",
      "error.peerError": "Peer error",
      "error.notVerified": "You cannot send a message until the security number is verified",
      "error.emptyMessage": "Cannot send an empty message",
      "error.messageTooLong": "Message too long",
      "error.emptyFile": "Cannot send an empty file",
      "error.fileTooLarge": "File too large (max 8 MB)",
      "error.fileTypeForbidden": "This file type is not allowed",
      "error.fileNotFound": "File not found",
      "error.channelClosed": "Data channel is not open",
      "error.recallUnauthorized": "This message cannot be deleted (you can only delete your own sent messages)",
      "error.recallExpired": "Recall window expired (5 minutes)",
      "error.codeExpired": "The code has expired or is invalid",
      "error.identityChanged": "Identity changed \u2014 verify the security number",
      "error.noPendingIdentity": "No pending identity change",
      "error.peerLimit": "Concurrent connection limit reached",
      "error.decryptFailed": "Could not decrypt message: ",
      "error.codeEmpty": "No connection code entered",
      "error.codeIsAddress": 'This is a "My identity" (address), not a connection code. Ask your friend for the code from their "Code" tab.',
      "error.codeInvalid": "Invalid connection code",
      "error.codeIncomplete": "Connection code is missing fields",
      "error.codecInvalid": "Invalid connection code",
      "error.resetFailed": "Could not reset identity",
      "error.sendReadFailed": "Could not send a read receipt"
    }
  };
  var lang = (() => {
    try {
      const l = (typeof navigator !== "undefined" && navigator.language ? navigator.language : "tr").toLowerCase();
      return l.startsWith("tr") ? "tr" : "en";
    } catch (e) {
      return "tr";
    }
  })();
  function getLang() {
    return lang;
  }
  function setLang(next) {
    lang = next === "en" ? "en" : "tr";
  }
  function t(key, vars) {
    let str = dict[lang] && dict[lang][key] !== void 0 ? dict[lang][key] : dict.tr[key] !== void 0 ? dict.tr[key] : key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      }
    }
    return str;
  }
  function applyI18n(root) {
    const r = root || document;
    r.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    r.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    r.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    r.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
  }

  // src/popup.js
  var import_qrcode = __toESM(require_browser(), 1);

  // src/voice.js
  var VOICE_CHUNK_SIZE = 64 * 1024;
  var VOICE_MAX_SECONDS = 60;
  var VOICE_MAX_BYTES = 8 * 1024 * 1024;
  var VOICE_MAX_PARTS = Math.ceil(VOICE_MAX_BYTES / VOICE_CHUNK_SIZE);
  async function startVoiceRecorder({ onTick, onComplete, onError, maxSeconds = VOICE_MAX_SECONDS }) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error("err.micDenied");
    }
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : void 0);
    const chunks = [];
    let elapsed = 0;
    let timer = null;
    const finish = () => {
      clearInterval(timer);
      if (rec.state === "recording") rec.stop();
      stream.getTracks().forEach((t2) => t2.stop());
    };
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    rec.onerror = () => {
      finish();
      if (onError) onError(new Error("err.voiceFailed"));
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (onComplete) onComplete(blob);
    };
    rec.start();
    timer = setInterval(() => {
      elapsed++;
      if (elapsed >= maxSeconds) {
        finish();
        return;
      }
      if (onTick) onTick(elapsed);
    }, 1e3);
    return {
      stop: finish,
      elapsed: () => elapsed
    };
  }
  function createCallPeerConnection({ iceServers, onIce, onTrack, onStateChange, onFail }) {
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: iceServers && iceServers.length ? iceServers : [] });
    } catch (e) {
      if (onFail) onFail(new Error("call.unsupported"));
      return null;
    }
    pc.onicecandidate = (ev) => {
      if (ev.candidate && onIce) onIce(ev.candidate);
    };
    pc.ontrack = (ev) => {
      if (ev.streams && ev.streams[0] && onTrack) onTrack(ev.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (onStateChange) onStateChange(pc.connectionState);
    };
    return pc;
  }
  function attachLocalTracks(pc, stream) {
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
  }

  // src/popup.js
  var $ = (id) => document.getElementById(id);
  var activePeer = null;
  var trustVerified = false;
  window.__sessions = [];
  window.__unread = {};
  window.__readAckOff = {};
  window.__pendingRead = {};
  window.__voiceUrls = {};
  window.__voiceRec = null;
  window.__voiceDraft = null;
  window.__call = null;
  window.__callPendingDesc = null;
  window.__callTimerId = null;
  function sendToOffscreen(action, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ target: "offscreen", action, ...payload }, (resp) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(resp || { ok: false, error: "cevap yok" });
      });
    });
  }
  function showView(view) {
    $("loginView").classList.toggle("hidden", view !== "login");
    $("mainView").classList.toggle("hidden", view !== "main");
  }
  function showPanel(panel) {
    ["connect", "code", "chat"].forEach((p) => {
      $("panel" + p[0].toUpperCase() + p.slice(1)).classList.toggle("hidden", p !== panel);
    });
    ["tabConnect", "tabCode", "tabChat"].forEach((t2, i) => {
      const isActive = ["connect", "code", "chat"][i] === panel;
      $(t2).classList.toggle("active", isActive);
      if (isActive) $(t2).setAttribute("aria-selected", "true");
      else $(t2).setAttribute("aria-selected", "false");
    });
    if (panel === "chat" && activePeer) flushReads(activePeer);
  }
  function addMessage(text, who, msgType, mid, ts) {
    const div = document.createElement("div");
    div.className = "msg " + (msgType || "in");
    if (mid) div.dataset.mid = mid;
    div.dataset.user = who === "ben" ? activePeer : who;
    const inner = document.createElement("div");
    inner.className = "msg-bubble";
    if (who) {
      const whoSpan = document.createElement("span");
      whoSpan.className = "who";
      whoSpan.textContent = who;
      inner.appendChild(whoSpan);
    }
    const bodyEl = document.createElement("span");
    bodyEl.className = "msg-body";
    bodyEl.textContent = text;
    inner.appendChild(bodyEl);
    if (msgType === "out") {
      const st = document.createElement("span");
      st.className = "msg-status";
      st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
      inner.appendChild(st);
      const menu = document.createElement("button");
      menu.className = "msg-menu";
      menu.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></svg>';
      menu.addEventListener("click", (e) => {
        e.stopPropagation();
        openMessageMenu(menu, div);
      });
      inner.appendChild(menu);
    }
    if (ts) {
      const time = document.createElement("span");
      time.className = "msg-time";
      time.textContent = new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      inner.appendChild(time);
    }
    div.appendChild(inner);
    $("chatMessages").appendChild(div);
    div.hidden = div.dataset.user !== activePeer;
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  }
  function renderTabs() {
    const tabs = $("chatTabs");
    tabs.innerHTML = "";
    for (const username of window.__sessions || []) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "chat-tab" + (username === activePeer ? " active" : "");
      const n = (window.__unread || {})[username] || 0;
      tab.appendChild(document.createTextNode(username));
      if (n) {
        const badge = document.createElement("span");
        badge.className = "unread-badge";
        badge.textContent = n;
        tab.appendChild(badge);
      }
      tab.setAttribute("data-username", username);
      tab.addEventListener("click", () => openPeer(username));
      tabs.appendChild(tab);
    }
  }
  function sendReadIfVisible(username, mid) {
    if (window.__readAckOff[username]) return;
    if (!isChatVisible()) return;
    sendToOffscreen("sendRead", { username, mid });
  }
  function queueRead(username, mid) {
    if (username === activePeer && isChatVisible()) {
      sendReadIfVisible(username, mid);
    } else {
      if (!window.__pendingRead[username]) window.__pendingRead[username] = /* @__PURE__ */ new Set();
      window.__pendingRead[username].add(mid);
    }
  }
  function flushReads(username) {
    const set = window.__pendingRead[username];
    if (!set || set.size === 0) return;
    for (const mid of set) sendReadIfVisible(username, mid);
    set.clear();
  }
  function isChatVisible() {
    const mainHidden = $("mainView").classList.contains("hidden");
    const panelHidden = $("panelChat").classList.contains("hidden");
    return !mainHidden && !panelHidden;
  }
  function openPeer(username) {
    activePeer = username;
    if (username && window.__unread) window.__unread[username] = 0;
    document.querySelectorAll("#chatMessages .msg").forEach((n) => {
      n.hidden = n.dataset.user !== username;
    });
    $("chatPeer").textContent = username || "";
    renderTabs();
    renderReadToggle();
    if (username) flushReads(username);
  }
  var _typingHintTimer = null;
  function showTypingHint(peer) {
    if (peer && peer !== activePeer) return;
    const hint = $("typingHint");
    if (!hint) return;
    hint.hidden = false;
    clearTimeout(_typingHintTimer);
    _typingHintTimer = setTimeout(() => {
      hint.hidden = true;
    }, 3e3);
  }
  function refreshSessions() {
    sendToOffscreen("status").then((res) => {
      if (res && res.ok) {
        window.__sessions = res.sessions || [];
        applyTheme(res.theme || "bone");
        renderTabs();
      }
    });
  }
  async function refreshContacts() {
    const r = await sendToOffscreen("listContacts", {});
    const list = $("contactList");
    if (!list) return;
    list.innerHTML = "";
    if (r && r.contacts) {
      for (const c of r.contacts) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "contact-item";
        btn.textContent = c.username + " \xB7 " + (c.verified ? t("contact.verified") : t("contact.new"));
        btn.addEventListener("click", async () => {
          const res = await sendToOffscreen("reconnectContact", { username: c.username });
          if (!res || !res.ok) showTempError(res && res.error ? errorText(res.error) : t("err.reconnectFailed"));
        });
        list.appendChild(btn);
      }
    }
  }
  function schemeFor(mode) {
    if (mode === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "bone";
    return mode;
  }
  function applyTheme(mode) {
    const doc = document.documentElement;
    doc.dataset.theme = schemeFor(mode);
    doc.dataset.themeMode = mode;
    const sel = $("themeSelect");
    if (sel && sel.value !== mode) sel.value = mode;
  }
  function initTheme() {
    refreshSessions();
  }
  var themeMQ = window.matchMedia("(prefers-color-scheme: dark)");
  themeMQ.addEventListener("change", () => {
    if (document.documentElement.dataset.themeMode === "system") applyTheme("system");
  });
  $("themeSelect").addEventListener("change", () => {
    const mode = $("themeSelect").value || "bone";
    sendToOffscreen("setTheme", { mode });
    applyTheme(mode);
  });
  function openMessageMenu(btn, bubble) {
    const menu = document.createElement("div");
    menu.className = "msg-menu-popup";
    const local = document.createElement("button");
    local.textContent = t("menu.local");
    local.addEventListener("click", () => bubble.remove());
    menu.appendChild(local);
    const remote = document.createElement("button");
    remote.textContent = t("menu.remote");
    remote.className = "danger";
    const mid = bubble.dataset.mid;
    const rec = window.__sentMids && window.__sentMids[mid];
    const expired = !rec || Date.now() - rec.ts > 5 * 60 * 1e3;
    remote.disabled = !!expired;
    if (expired) remote.title = t("menu.expired");
    remote.addEventListener("click", () => {
      if (!mid) return;
      sendToOffscreen("recallMessage", { username: activePeer, mid }).then((res) => {
        if (res && res.ok) {
          markDeleted(mid);
          showTempError(t("err.recallSent"));
        } else {
          showTempError(res && res.error ? errorText(res.error) : t("err.recallFailed"));
        }
      });
      menu.remove();
    });
    menu.appendChild(remote);
    btn.parentNode.appendChild(menu);
    const close = (e2) => {
      if (!menu.contains(e2.target) && e2.target !== btn) menu.remove();
      document.removeEventListener("click", close);
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }
  function markDeleted(mid) {
    const el = document.querySelector('.msg[data-mid="' + mid + '"] .msg-body');
    if (!el) return;
    el.textContent = t("chat.recalled");
    el.setAttribute("data-i18n", "chat.recalled");
    el.classList.add("recalled");
  }
  function markRecallAcked(mid) {
    const bubble = document.querySelector('.msg[data-mid="' + mid + '"]');
    if (!bubble) return;
    const note = document.createElement("div");
    note.className = "msg-note";
    note.textContent = t("chat.deletedRemote");
    note.setAttribute("data-i18n", "chat.deletedRemote");
    bubble.appendChild(note);
  }
  function fileSizeLabel(bytes) {
    if (!bytes) return "0 B";
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return Math.max(1, Math.ceil(bytes / 1024)) + " KB";
  }
  function addFileCard(mid, name, size, type, peer, side) {
    const div = document.createElement("div");
    div.className = "msg " + (side === "out" ? "out" : "in");
    div.dataset.file = mid;
    div.dataset.user = peer || activePeer;
    const inner = document.createElement("div");
    inner.className = "msg-bubble file-card";
    const head = document.createElement("div");
    head.className = "file-head";
    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8L9.5 18a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>';
    const meta = document.createElement("div");
    meta.className = "file-meta";
    const nm = document.createElement("div");
    nm.className = "file-name";
    nm.textContent = name;
    const si = document.createElement("div");
    si.className = "file-sub";
    si.textContent = fileSizeLabel(size) + (type ? " \xB7 " + type : "");
    meta.appendChild(nm);
    meta.appendChild(si);
    head.appendChild(icon);
    head.appendChild(meta);
    inner.appendChild(head);
    const prog = document.createElement("div");
    prog.className = "file-progress hidden";
    const track = document.createElement("div");
    track.className = "file-progress-track";
    const fill = document.createElement("div");
    fill.className = "file-progress-fill";
    track.appendChild(fill);
    const pct = document.createElement("span");
    pct.className = "file-progress-pct";
    prog.appendChild(track);
    prog.appendChild(pct);
    inner.appendChild(prog);
    const actions = document.createElement("div");
    actions.className = "file-actions hidden";
    if (side === "in") {
      actions.classList.remove("hidden");
      const accept = document.createElement("button");
      accept.className = "primary";
      accept.textContent = t("file.accept");
      accept.addEventListener("click", async () => {
        const res = await sendToOffscreen("acceptFileTransfer", { username: peer, mid, accept: true });
        if (res && res.ok) {
          actions.classList.add("hidden");
          prog.classList.remove("hidden");
        } else {
          showTempError(res && res.error ? errorText(res.error) : t("err.fileRecvFailed"));
        }
      });
      const reject = document.createElement("button");
      reject.className = "danger";
      reject.textContent = t("file.decline");
      reject.addEventListener("click", async () => {
        const res = await sendToOffscreen("acceptFileTransfer", { username: peer, mid, accept: false });
        if (res && res.ok) {
          div.remove();
          if (window.__fileCards) delete window.__fileCards[mid];
        } else showTempError(res && res.error ? errorText(res.error) : t("err.fileRejectFailed"));
      });
      actions.appendChild(accept);
      actions.appendChild(reject);
    } else {
      prog.classList.remove("hidden");
      pct.textContent = "0%";
    }
    inner.appendChild(actions);
    div.appendChild(inner);
    $("chatMessages").appendChild(div);
    div.hidden = (peer || activePeer) !== activePeer;
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
    if (!window.__fileCards) window.__fileCards = {};
    window.__fileCards[mid] = div;
    return div;
  }
  function updateFileCard(mid, opts) {
    const div = (window.__fileCards || {})[mid];
    if (!div) return;
    const prog = div.querySelector(".file-progress");
    const fill = div.querySelector(".file-progress-fill");
    const pct = div.querySelector(".file-progress-pct");
    if (typeof opts.percent === "number") {
      prog.classList.remove("hidden");
      fill.style.transform = "scaleX(" + Math.min(1, (opts.percent || 0) / 100) + ")";
      pct.textContent = opts.percent + "%";
    }
    if (opts.complete) {
      const link = document.createElement("a");
      link.className = "file-preview";
      link.href = opts.url;
      link.textContent = t("file.view");
      link.target = "_blank";
      div.querySelector(".msg-bubble").appendChild(link);
      if (fill) fill.style.transform = "scaleX(1)";
      if (pct) pct.textContent = "100%";
    }
    if (opts.note) {
      const note = document.createElement("div");
      note.className = "msg-note file-note" + (opts.danger ? " danger-text" : "");
      note.textContent = opts.note;
      if (opts.noteKey) note.setAttribute("data-i18n", opts.noteKey);
      div.querySelector(".msg-bubble").appendChild(note);
    }
  }
  function clearFileCards() {
    window.__fileCards = {};
    for (const mid in window.__fileUrls || {}) {
      try {
        URL.revokeObjectURL(window.__fileUrls[mid]);
      } catch (e) {
      }
    }
    window.__fileUrls = {};
    document.querySelectorAll("#chatMessages .msg[data-file]").forEach((n) => n.remove());
  }
  function addVoiceChip(mid, bytes, mime, who) {
    const div = document.createElement("div");
    div.className = "msg " + (who === "out" ? "out" : "in");
    div.dataset.voice = mid;
    div.dataset.mid = mid;
    div.dataset.user = who === "out" ? activePeer : activePeer || "in";
    div.hidden = div.dataset.user !== activePeer;
    const inner = document.createElement("div");
    inner.className = "msg-bubble voice-chip";
    if (window.__voiceUrls[mid]) {
      try {
        URL.revokeObjectURL(window.__voiceUrls[mid]);
      } catch (e) {
      }
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || "audio/webm" }));
    window.__voiceUrls[mid] = url;
    const audio = document.createElement("audio");
    audio.src = url;
    audio.preload = "metadata";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "voice-play";
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>';
    const progressWrap = document.createElement("div");
    progressWrap.className = "voice-progress";
    const fill = document.createElement("div");
    fill.className = "voice-progress-fill";
    progressWrap.appendChild(fill);
    const durEl = document.createElement("span");
    durEl.className = "voice-time mono";
    toggle.addEventListener("click", () => {
      if (audio.paused) {
        audio.play();
        toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>';
      } else {
        audio.pause();
        toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>';
      }
    });
    audio.addEventListener("timeupdate", () => {
      const d = audio.duration || 0;
      fill.style.transform = "scaleX(" + (d ? audio.currentTime / d : 0) + ")";
    });
    audio.addEventListener("loadedmetadata", () => {
      durEl.textContent = (audio.duration ? Math.ceil(audio.duration) : 0) + "s";
    });
    audio.addEventListener("ended", () => {
      toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10-6.5Z"/></svg>';
    });
    inner.appendChild(toggle);
    inner.appendChild(progressWrap);
    inner.appendChild(durEl);
    if (who === "out") {
      const st = document.createElement("span");
      st.className = "msg-status";
      st.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
      inner.appendChild(st);
    }
    div.appendChild(inner);
    $("chatMessages").appendChild(div);
    div.hidden = div.dataset.user !== activePeer;
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
    return div;
  }
  function clearVoiceCards() {
    for (const mid in window.__voiceUrls || {}) {
      try {
        URL.revokeObjectURL(window.__voiceUrls[mid]);
      } catch (e) {
      }
    }
    window.__voiceUrls = {};
    document.querySelectorAll("#chatMessages .msg[data-voice]").forEach((n) => n.remove());
  }
  function clearVoiceDraft() {
    const d = window.__voiceDraft;
    if (!d) return;
    try {
      URL.revokeObjectURL(d.url);
    } catch (e) {
    }
    window.__voiceDraft = null;
    $("voiceDraftBar").classList.add("hidden");
    const a = $("voiceDraftAudio");
    if (a) a.removeAttribute("src");
  }
  function stopActiveRecording() {
    if (window.__voiceRec) {
      try {
        window.__voiceRec.stop();
      } catch (e) {
      }
      window.__voiceRec = null;
    }
    $("micBtn").classList.remove("recording");
    $("micBtn").textContent = "";
  }
  function showRecordingTick(seconds) {
    const btn = $("micBtn");
    const left = Math.max(0, 60 - seconds);
    btn.textContent = ":" + String(left).padStart(2, "0");
  }
  function showVoiceDraftBar(blob) {
    const url = blob ? URL.createObjectURL(blob) : null;
    window.__voiceDraft = blob ? { url, blob, mime: blob.type || "audio/webm" } : null;
    const bar = $("voiceDraftBar");
    const audio = $("voiceDraftAudio");
    bar.classList.remove("hidden");
    if (audio && url) {
      audio.src = url;
      audio.load();
    }
  }
  async function startVoiceRecording() {
    if (!activePeer) {
      showTempError(t("err.openChatFirst"));
      return;
    }
    if (window.__voiceRec) return;
    try {
      window.__voiceRec = await startVoiceRecorder({
        onTick: showRecordingTick,
        onComplete: (blob) => {
          window.__voiceRec = null;
          $("micBtn").classList.remove("recording");
          $("micBtn").textContent = "";
          if (blob && blob.size) showVoiceDraftBar(blob);
        },
        onError: (e) => {
          window.__voiceRec = null;
          $("micBtn").classList.remove("recording");
          $("micBtn").textContent = "";
          showTempError(errorText(e.message));
        }
      });
      $("micBtn").classList.add("recording");
      showRecordingTick(0);
    } catch (e) {
      showTempError(errorText(e.message || "err.micDenied"));
    }
  }
  async function sendVoiceDraft() {
    const d = window.__voiceDraft;
    if (!d) return;
    if (!activePeer) {
      showTempError(t("err.openChatFirst"));
      return;
    }
    try {
      const bytes = await d.blob.arrayBuffer();
      const expiryEl = $("expirySelect");
      const expSeconds = parseInt(expiryEl && expiryEl.value || "0", 10);
      const res = await sendToOffscreen("sendVoiceMessage", { username: activePeer, bytes, mime: d.mime, expSeconds });
      if (res && res.ok) {
        addVoiceChip(res.mid, bytes, d.mime, "out");
        if (res.mid) {
          if (!window.__sentMids) window.__sentMids = {};
          window.__sentMids[res.mid] = { ts: Date.now() };
          if (expSeconds) {
            if (!window.__expiryMids) window.__expiryMids = {};
            window.__expiryMids[res.mid] = expSeconds;
            if (!window.__expiryTimers) window.__expiryTimers = {};
            window.__expiryTimers[res.mid] = setTimeout(() => removeMessageBubble(res.mid), expSeconds * 1e3);
          }
        }
        clearVoiceDraft();
      } else {
        showTempError(res && res.error ? errorText(res.error) : t("err.voiceSendFailed"));
      }
    } catch (e) {
      showTempError(t("err.voiceSendFailed"));
    }
  }
  $("micBtn").addEventListener("click", startVoiceRecording);
  $("voiceDraftSendBtn").addEventListener("click", sendVoiceDraft);
  $("voiceDraftCancelBtn").addEventListener("click", clearVoiceDraft);
  async function handleCallStart(mode) {
    if (!activePeer) {
      showTempError(t("err.openChatFirst"));
      return;
    }
    if (window.__call) {
      showTempError(t("error.callActive"));
      return;
    }
    const startRes = await sendToOffscreen("startCall", { username: activePeer, mode });
    if (!startRes || !startRes.ok) {
      showTempError(startRes && startRes.error ? errorText(startRes.error) : t("err.callStartFailed"));
      return;
    }
    $("callPeer").textContent = activePeer;
    callUiPhase("outgoing", mode);
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia(mode === "video" ? { audio: true, video: true } : { audio: true });
    } catch (e) {
      showTempError(t("err.micDenied"));
      sendToOffscreen("callSignal", { username: activePeer, callId: startRes.callId, c: "end" }).catch(() => {
      });
      closeCallUi();
      return;
    }
    window.__call = { callId: startRes.callId, username: activePeer, mode, pc: null, localStream, remoteStream: null, phase: "outgoing", pendingIce: [] };
    if ($("localVideo")) $("localVideo").srcObject = localStream;
    const pc = createCallPeerConnection({
      iceServers: startRes.iceServers,
      onIce: (candidate) => {
        const call = window.__call;
        if (call && call.phase !== "closed") {
          sendToOffscreen("callSignal", { username: call.username, callId: call.callId, c: "ice", candidate });
        }
      },
      onTrack: (stream) => {
        const call = window.__call;
        if (call && call.phase !== "closed") {
          call.remoteStream = stream;
          if ($("remoteVideo")) {
            $("remoteVideo").srcObject = stream;
            $("remoteVideo").play().catch(() => {
            });
          }
        }
      },
      onStateChange: () => {
      },
      onFail: () => {
        showTempError(t("call.unsupported"));
        teardownCall();
      }
    });
    if (!pc) return;
    window.__call.pc = pc;
    attachLocalTracks(pc, localStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendToOffscreen("callSignal", { username: activePeer, callId: startRes.callId, c: "request", mode, desc: offer.toJSON() });
  }
  $("callBtn").addEventListener("click", () => handleCallStart("audio"));
  $("callVideoBtn").addEventListener("click", () => handleCallStart("video"));
  function removeMessageBubble(mid) {
    const bubble = document.querySelector('.msg[data-mid="' + mid + '"]');
    if (bubble) bubble.remove();
  }
  function clearPopupExpiryState() {
    window.__sentMids = {};
    window.__expiryMids = {};
    if (window.__expiryTimers) {
      for (const mid in window.__expiryTimers) clearTimeout(window.__expiryTimers[mid]);
    }
    window.__expiryTimers = {};
  }
  function setStatus(text, state) {
    const el = $("connectionState");
    el.setAttribute("data-state", state || "offline");
    el.querySelector(".pill-text").textContent = text;
  }
  function groupFingerprint(fp) {
    const digits = fp.replace(/\D/g, "");
    return digits.match(/.{1,10}/g) || [];
  }
  function renderFingerprint(fp) {
    const groups = groupFingerprint(fp);
    const el = document.createElement("div");
    el.className = "fp-digits";
    groups.forEach((g) => {
      const row = document.createElement("div");
      row.className = "fp-row";
      const half = Math.ceil(g.length / 2);
      row.innerHTML = "<span>" + g.slice(0, half) + "</span><span>" + g.slice(half) + "</span>";
      el.appendChild(row);
    });
    return el;
  }
  function setTrustVerified(verified) {
    trustVerified = verified;
    const card = $("fpCard");
    if (card) card.classList.toggle("verified", verified);
    if ($("sendBtn")) $("sendBtn").disabled = !verified;
    if (verified) {
      setStatus(t("status.verified"), "verified");
      $("chatHeader").classList.add("verified");
    } else {
      $("chatHeader").classList.remove("verified");
      setStatusToConnection();
    }
  }
  function setStatusToConnection() {
    if ($("mainView").classList.contains("hidden")) return;
    if (trustVerified) {
      setStatus(t("status.verified"), "verified");
      return;
    }
    if (activePeer) setStatus(t("status.chatPrefix") + activePeer, "chatting");
    else setStatus(t("status.online"), "online");
  }
  function callUiPhase(phase, mode) {
    $("callOverlay").classList.remove("hidden");
    const isVideo = mode === "video";
    $("callVideos") && $("callVideos").classList.toggle("hidden", !isVideo);
    $("callAvatar") && $("callAvatar").classList.toggle("hidden", isVideo);
    $("callAcceptBtn").classList.toggle("hidden", phase !== "incoming");
    $("callEndBtn").classList.toggle("hidden", phase !== "active");
    $("callMuteBtn").classList.toggle("hidden", phase !== "active");
    $("callVideoToggleBtn") && $("callVideoToggleBtn").classList.toggle("hidden", isVideo || phase !== "active");
    if (phase === "outgoing") $("callStatus").textContent = t("call.calling");
    if (phase === "incoming") $("callStatus").textContent = t("call.ringing");
    if (phase === "active") $("callStatus").textContent = t("call.activeNote");
  }
  function closeCallUi() {
    $("callOverlay").classList.add("hidden");
    if ($("localVideo")) $("localVideo").srcObject = null;
    if ($("remoteVideo")) $("remoteVideo").srcObject = null;
    $("callTimer").hidden = true;
    if (window.__callTimerId) {
      clearInterval(window.__callTimerId);
      window.__callTimerId = null;
    }
  }
  function startCallTimer() {
    const start = Date.now();
    $("callTimer").hidden = false;
    clearInterval(window.__callTimerId);
    window.__callTimerId = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1e3);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      $("callTimer").textContent = mm + ":" + ss;
    }, 1e3);
  }
  function teardownCall() {
    const c = window.__call;
    if (!c) return;
    if (c.pc) {
      try {
        c.pc.close();
      } catch (e) {
      }
    }
    if (c.localStream) c.localStream.getTracks().forEach((t2) => t2.stop());
    window.__call = null;
    closeCallUi();
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.target !== "popup" || !msg.ev) return;
    switch (msg.ev) {
      case "message":
        setStatusToConnection();
        addMessage(msg.payload.text, msg.payload.from, "in", msg.payload.mid, msg.payload.ts);
        queueRead(msg.payload.from, msg.payload.mid);
        if (!window.__unread) window.__unread = {};
        if (msg.payload.from !== activePeer) {
          window.__unread[msg.payload.from] = (window.__unread[msg.payload.from] || 0) + 1;
          renderTabs();
        }
        break;
      case "typing":
        showTypingHint(msg.payload.from);
        break;
      case "connected":
        openPeer(msg.payload.peer || msg.payload.username);
        setStatusToConnection();
        trustVerified = false;
        $("chatHeader").classList.remove("verified");
        if ($("sendBtn")) $("sendBtn").disabled = true;
        addMessage(t("chat.secure"), msg.payload.peer || msg.payload.username, "in");
        refreshSessions();
        refreshContacts();
        break;
      case "fingerprint":
        trustVerified = false;
        $("fpToast").classList.remove("hidden");
        $("fpToast").textContent = "";
        const card = document.createElement("div");
        card.id = "fpCard";
        card.className = "fp-card";
        card.innerHTML = '<div class="fp-head"><span class="fp-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9.5V14.5M9.5 12H14.5"/></svg></span><div><div class="fp-title" data-i18n="fp.title">' + t("fp.title") + '</div><div class="fp-sub" data-i18n="fp.sub">' + t("fp.sub") + "</div></div></div>";
        card.appendChild(renderFingerprint(msg.payload.fingerprint));
        const actions = document.createElement("div");
        actions.className = "fp-actions";
        const yes = document.createElement("button");
        yes.className = "primary";
        yes.textContent = t("fp.match");
        yes.setAttribute("data-i18n", "fp.match");
        const dontMatch = document.createElement("button");
        dontMatch.className = "danger";
        dontMatch.textContent = t("fp.mismatch");
        dontMatch.setAttribute("data-i18n", "fp.mismatch");
        actions.appendChild(yes);
        actions.appendChild(dontMatch);
        card.appendChild(actions);
        const confirmed = document.createElement("div");
        confirmed.className = "fp-confirmed";
        confirmed.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19 7.5"/></svg><span data-i18n="fp.verified">' + t("fp.verified") + "</span>";
        card.appendChild(confirmed);
        $("fpToast").appendChild(card);
        yes.addEventListener("click", async () => {
          const res = await sendToOffscreen("verifyFingerprint", { username: msg.payload.username });
          if (res && res.ok) {
            setTrustVerified(true);
            $("fpToast").classList.add("hidden");
            $("fpToast").textContent = "";
            refreshContacts();
          } else {
            showTempError(res && res.error ? errorText(res.error) : t("err.verificationFailed"));
          }
        });
        dontMatch.addEventListener("click", async () => {
          const res = await sendToOffscreen("rejectFingerprint", { username: msg.payload.username });
          setTrustVerified(false);
          $("fpToast").classList.add("hidden");
          $("fpToast").textContent = "";
          showTempError(t("fp.mismatchEnded"));
        });
        break;
      case "error":
        setStatus(t("status.error"), "error");
        showTempError(errorText(msg.payload.message));
        break;
      case "codeUsed":
        refreshSessions();
        break;
      case "status":
        if (msg.payload.status === "error") showTempError(t("err.connectionError") + msg.payload.detail);
        refreshSessions();
        break;
      case "deleted":
        markDeleted(msg.payload.mid);
        break;
      case "recallAck":
        markRecallAcked(msg.payload.mid);
        break;
      case "delivered": {
        const midEl = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
        if (midEl) midEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13"/></svg>';
        break;
      }
      case "read": {
        const midEl = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
        if (midEl) midEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13" stroke="var(--trust-deep)"/></svg>';
        break;
      }
      case "fileOffer": {
        const p = msg.payload;
        addFileCard(p.mid, p.name, p.size, p.type, p.from, "in");
        if (activePeer && p.from !== activePeer) {
          if (!window.__unread) window.__unread = {};
          window.__unread[p.from] = (window.__unread[p.from] || 0) + 1;
          renderTabs();
        }
        break;
      }
      case "fileProgress":
        updateFileCard(msg.payload.mid, { percent: Math.round((msg.payload.idx + 1) / (msg.payload.total || 1) * 100) });
        break;
      case "fileComplete": {
        const p = msg.payload;
        if (!window.__fileUrls) window.__fileUrls = {};
        const url = URL.createObjectURL(new Blob([p.bytes]));
        window.__fileUrls[p.mid] = url;
        updateFileCard(p.mid, { complete: true, url });
        break;
      }
      case "fileDeclined":
        updateFileCard(msg.payload.mid, { note: t("file.declined"), noteKey: "file.declined", danger: true });
        break;
      case "fileSent":
        updateFileCard(msg.payload.mid, { note: t("file.sent"), noteKey: "file.sent" });
        break;
      case "fileAck":
        updateFileCard(msg.payload.mid, { note: t("file.complete"), noteKey: "file.complete" });
        break;
      case "voiceMessage": {
        const p = msg.payload;
        addVoiceChip(p.mid, p.bytes, p.mime, "in");
        if (p.from && activePeer && p.from !== activePeer) {
          if (!window.__unread) window.__unread = {};
          window.__unread[p.from] = (window.__unread[p.from] || 0) + 1;
          renderTabs();
        }
        break;
      }
      case "voiceSent": {
        const el = document.querySelector('#chatMessages .msg[data-mid="' + msg.payload.mid + '"] .msg-status');
        if (el) el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 13l4.5 4.5L20.5 6"/><path d="M10.5 13.5 15 18.5 20.5 13"/></svg>';
        break;
      }
      case "callSignal": {
        const p = msg.payload;
        const call = window.__call;
        if (p.c === "request") {
          if (call) {
            return;
          }
          $("callPeer").textContent = p.from;
          callUiPhase("incoming", p.mode);
          window.__call = { callId: p.callId, username: p.from, mode: p.mode, pc: null, localStream: null, remoteStream: null, phase: "incoming", pendingIce: [] };
          window.__callPendingDesc = p.desc;
        } else if (p.c === "answer") {
          if (call && call.callId === p.callId && call.phase === "outgoing") {
            call.phase = "active";
            callUiPhase("active", call.mode);
            startCallTimer();
            awaitRemoteAnswer(call, p.desc);
          }
        } else if (p.c === "ice") {
          if (call && call.callId === p.callId) {
            if (call.pc && call.pc.remoteDescription) {
              try {
                call.pc.addIceCandidate(p.candidate).catch(() => {
                });
              } catch (e) {
              }
            } else {
              call.pendingIce.push(p.candidate);
            }
          }
        } else if (p.c === "reject") {
          showTempError(t("call.endedNote"));
          teardownCall();
        }
        break;
      }
      case "callEnded":
        teardownCall();
        break;
      case "callBlocked":
        showTempError(t("err.callBlocked"));
        break;
      case "expired":
        removeMessageBubble(msg.payload.mid);
        break;
      case "chatTimer":
        if (msg.payload && typeof msg.payload.seconds === "number") {
          $("chatTimerSelect").value = String(msg.payload.seconds);
        }
        break;
      case "panic":
        clearPopupExpiryState();
        $("chatMessages").textContent = "";
        clearFileCards();
        stopActiveRecording();
        clearVoiceDraft();
        clearVoiceCards();
        teardownCall();
        $("chatTimerSelect").value = "0";
        $("expirySelect").value = "0";
        clearInterval(codeCountdownTimer);
        $("codeCountdown").hidden = true;
        renderQr("");
        showDecoy();
        break;
      case "reset":
        clearPopupExpiryState();
        activePeer = null;
        window.__unread = {};
        $("chatMessages").textContent = "";
        clearFileCards();
        stopActiveRecording();
        clearVoiceDraft();
        clearVoiceCards();
        teardownCall();
        $("chatPeer").textContent = t("chat.peer");
        $("chatTimerSelect").value = "0";
        $("expirySelect").value = "0";
        $("myPeerId").textContent = msg.payload.peerId;
        $("generatedCode").textContent = "\u2014";
        clearInterval(codeCountdownTimer);
        $("codeCountdown").hidden = true;
        renderQr("");
        setStatus(t("status.online"), "online");
        showPanel("connect");
        refreshSessions();
        refreshContacts();
        break;
    }
  });
  async function awaitRemoteAnswer(call, desc) {
    if (desc) {
      await call.pc.setRemoteDescription(desc);
      for (const cand of call.pendingIce.splice(0)) {
        try {
          call.pc.addIceCandidate(cand).catch(() => {
          });
        } catch (e) {
        }
      }
    }
  }
  async function answerCall(accept) {
    const call = window.__call;
    if (!call || call.phase !== "incoming") return;
    if (!accept) {
      sendToOffscreen("callSignal", { username: call.username, callId: call.callId, c: "reject" });
      teardownCall();
      return;
    }
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia(call.mode === "video" ? { audio: true, video: true } : { audio: true });
    } catch (e) {
      showTempError(t("err.micDenied"));
      sendToOffscreen("callSignal", { username: call.username, callId: call.callId, c: "reject" }).catch(() => {
      });
      teardownCall();
      return;
    }
    call.localStream = localStream;
    if ($("localVideo")) $("localVideo").srcObject = localStream;
    const pc = createCallPeerConnection({
      iceServers: [],
      onIce: (candidate) => {
        const c2 = window.__call;
        if (c2 && c2.phase !== "closed") sendToOffscreen("callSignal", { username: c2.username, callId: c2.callId, c: "ice", candidate });
      },
      onTrack: (stream) => {
        const c2 = window.__call;
        if (c2 && c2.phase !== "closed") {
          c2.remoteStream = stream;
          if ($("remoteVideo")) {
            $("remoteVideo").srcObject = stream;
            $("remoteVideo").play().catch(() => {
            });
          }
        }
      },
      onFail: () => {
        showTempError(t("call.unsupported"));
        teardownCall();
      }
    });
    if (!pc) return;
    call.pc = pc;
    attachLocalTracks(pc, localStream);
    await pc.setRemoteDescription(window.__callPendingDesc);
    for (const cand of call.pendingIce.splice(0)) {
      try {
        pc.addIceCandidate(cand).catch(() => {
        });
      } catch (e) {
      }
    }
    window.__callPendingDesc = null;
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    call.phase = "active";
    callUiPhase("active", call.mode);
    startCallTimer();
    sendToOffscreen("callSignal", { username: call.username, callId: call.callId, c: "answer", desc: answer.toJSON() });
  }
  $("callAcceptBtn").addEventListener("click", () => answerCall(true));
  $("callRejectBtn").addEventListener("click", () => answerCall(false));
  $("callEndBtn").addEventListener("click", () => {
    const call = window.__call;
    if (!call) return;
    sendToOffscreen("callSignal", { username: call.username, callId: call.callId, c: "end" });
    teardownCall();
  });
  $("callMuteBtn").addEventListener("click", () => {
    const call = window.__call;
    if (!call || !call.localStream) return;
    const mic = call.localStream.getAudioTracks()[0];
    if (mic) {
      mic.enabled = !mic.enabled;
      $("callMuteBtn").textContent = t(mic.enabled ? "call.mute" : "call.unmute");
    }
  });
  $("callVideoToggleBtn").addEventListener("click", () => {
    const call = window.__call;
    if (!call || !call.localStream) return;
    const vid = call.localStream.getVideoTracks()[0];
    if (vid) {
      vid.enabled = !vid.enabled;
      $("callVideoToggleBtn").textContent = t(vid.enabled ? "call.videoOff" : "call.videoOn");
      if ($("localVideo")) $("localVideo").style.opacity = vid.enabled ? "1" : "0.25";
    }
  });
  function errorText(e) {
    if (typeof e === "string" && e.indexOf("error.") === 0) return t(e);
    return e || t("err.sendFailed");
  }
  function showTempError(text) {
    let el = document.querySelector(".error");
    const host = $("loginView").classList.contains("hidden") ? $("mainView") : $("loginView");
    if (!el) {
      el = document.createElement("div");
      el.className = "error";
      host.appendChild(el);
      setTimeout(() => el.remove(), 6e3);
    }
    el.textContent = text;
  }
  function flashCopied(btn, backup) {
    const prev = btn.textContent;
    btn.textContent = t("code.copied");
    btn.style.color = "var(--trust-deep)";
    btn.style.borderColor = "var(--trust-line)";
    btn.style.background = "var(--trust-bg)";
    setTimeout(() => {
      btn.textContent = prev;
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.style.background = "";
    }, 1400);
  }
  $("copyCodeBtn").addEventListener("click", () => {
    const v = $("generatedCode").textContent.trim();
    if (!v || v === "\u2014") return;
    navigator.clipboard.writeText(v).then(() => flashCopied($("copyCodeBtn"))).catch(() => {
    });
  });
  function readNetworkConfig() {
    const cfg = {};
    const host = $("netHost") && $("netHost").value.trim();
    if (host) {
      cfg.host = host;
      const port = $("netPort") && $("netPort").value.trim();
      if (port) cfg.port = Number(port);
      const path = $("netPath") && $("netPath").value.trim();
      if (path) cfg.path = path;
    }
    const iceRaw = $("netIce") && $("netIce").value.trim();
    if (iceRaw) {
      try {
        const parsed = JSON.parse(iceRaw);
        if (Array.isArray(parsed)) cfg.iceServers = parsed;
      } catch (e) {
      }
    }
    return Object.keys(cfg).length ? cfg : void 0;
  }
  $("loginBtn").addEventListener("click", async () => {
    $("loginBtn").disabled = true;
    $("loginBtn").textContent = t("app.busy");
    const network = readNetworkConfig();
    const res = await sendToOffscreen("initPeer", { network });
    if (res.ok) {
      $("myPeerId").textContent = res.peerId;
      showView("main");
      showPanel("connect");
      $("chatPeer").textContent = t("chat.peer");
      setStatus(t("status.online"), "online");
      refreshContacts();
    } else {
      showTempError(errorText(res.error) === t("err.sendFailed") ? t("err.initFailed") : errorText(res.error));
    }
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = t("app.start");
  });
  async function attemptConnect(code) {
    const text = (code || "").trim();
    if (!text) {
      showTempError(t("err.noCode"));
      return;
    }
    if (/^[a-z2-7]{20}$/.test(text)) {
      showTempError(t("err.isAddress"));
      return;
    }
    const btn = $("connectBtn");
    btn.disabled = true;
    btn.textContent = t("connect.busy");
    $("safetyInfo").classList.remove("hidden");
    const res = await sendToOffscreen("connectCode", { code: text });
    if (res.ok) {
      openPeer(res.peer);
      showPanel("chat");
      setStatus(t("status.connecting"), "chatting");
      refreshSessions();
    } else {
      showTempError(res.error ? errorText(res.error) : t("err.connectFailed"));
    }
    btn.disabled = false;
    btn.textContent = t("connect.btn");
  }
  $("connectBtn").addEventListener("click", () => attemptConnect($("codeInput").value));
  var codeCountdownTimer = null;
  function renderCodeCountdown(exp) {
    const el = $("codeCountdown");
    const tick = () => {
      const left = (exp || 0) - Date.now();
      if (left <= 0) {
        el.textContent = t("code.expired");
        el.classList.add("expired");
        clearInterval(codeCountdownTimer);
        return;
      }
      el.classList.remove("expired");
      const s = Math.floor(left / 1e3);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      el.textContent = t("code.validFor") + mm + ":" + ss;
    };
    el.hidden = false;
    tick();
    clearInterval(codeCountdownTimer);
    codeCountdownTimer = setInterval(tick, 1e3);
  }
  function renderQr(text) {
    const wrap = document.querySelector(".qr-wrap");
    const canvas = $("qrCanvas");
    if (!wrap || !canvas) return;
    if (!text || text === "\u2014" || text === "-") {
      wrap.hidden = true;
      return;
    }
    import_qrcode.default.toCanvas(canvas, text, { errorCorrectionLevel: "M", margin: 1, width: 128 }).then(() => {
      wrap.hidden = false;
    }).catch(() => {
      wrap.hidden = true;
    });
  }
  $("genCodeBtn").addEventListener("click", async () => {
    const res = await sendToOffscreen("generateCode");
    if (res.ok) {
      $("generatedCode").textContent = res.code;
      renderQr(res.code);
      if (res.exp) renderCodeCountdown(res.exp);
      activePeer = null;
      $("copyCodeBtn").textContent = t("code.copy");
      $("chatPeer").textContent = t("chat.peer");
    } else {
      showTempError(res.error ? errorText(res.error) : t("err.genFailed"));
    }
  });
  $("sendBtn").addEventListener("click", sendMessage);
  $("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  var _typingDebounce = null;
  $("messageInput").addEventListener("input", () => {
    if (_typingDebounce) clearTimeout(_typingDebounce);
    _typingDebounce = setTimeout(() => {
      if (activePeer) sendToOffscreen("sendTyping", { username: activePeer });
    }, 1e3);
  });
  $("fileBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async () => {
    const f = $("fileInput").files && $("fileInput").files[0];
    $("fileInput").value = "";
    if (!f) return;
    if (!activePeer) {
      showTempError(t("err.openChatFirst"));
      return;
    }
    try {
      const bytes = await f.arrayBuffer();
      const res = await sendToOffscreen("sendFileOffer", { username: activePeer, name: f.name, mime: f.type, bytes });
      if (res && res.ok) {
        addFileCard(res.mid, f.name, bytes.byteLength, f.type, activePeer, "out");
      } else {
        showTempError(res && res.error ? errorText(res.error) : t("err.fileSendFailed"));
      }
    } catch (e) {
      showTempError(t("err.fileRead") + errorText(e.message));
    }
  });
  $("chatTimerSelect").addEventListener("change", () => {
    if (!activePeer) return;
    const seconds = parseInt($("chatTimerSelect").value || "0", 10);
    sendToOffscreen("setChatTimer", { username: activePeer, seconds });
  });
  var readAckBtn = $("readAckBtn");
  function renderReadToggle() {
    if (!readAckBtn) return;
    const off = !!window.__readAckOff[activePeer];
    readAckBtn.textContent = t(off ? "chat.readOff" : "chat.readOn");
    readAckBtn.classList.toggle("off", off);
    readAckBtn.setAttribute("aria-pressed", String(!off));
    readAckBtn.title = t(off ? "chat.readTitleOff" : "chat.readTitle");
  }
  if (readAckBtn) {
    readAckBtn.addEventListener("click", () => {
      if (!activePeer) return;
      window.__readAckOff[activePeer] = !window.__readAckOff[activePeer];
      renderReadToggle();
    });
    renderReadToggle();
  }
  async function sendMessage() {
    if (!activePeer) return;
    const text = $("messageInput").value.trim();
    if (!text) return;
    const expiryEl = $("expirySelect");
    const expSeconds = parseInt(expiryEl && expiryEl.value || "0", 10);
    const res = await sendToOffscreen("sendMessageTimed", { username: activePeer, text, expSeconds });
    if (res.ok) {
      const mid = res && res.mid || null;
      addMessage(text, "ben", "out", mid, Date.now());
      if (mid) {
        if (!window.__sentMids) window.__sentMids = {};
        window.__sentMids[mid] = { ts: Date.now() };
        if (expSeconds) {
          if (!window.__expiryMids) window.__expiryMids = {};
          window.__expiryMids[mid] = expSeconds;
          if (!window.__expiryTimers) window.__expiryTimers = {};
          window.__expiryTimers[mid] = setTimeout(() => removeMessageBubble(mid), expSeconds * 1e3);
        }
      }
      $("messageInput").value = "";
    } else {
      showTempError(errorText(res.error));
    }
  }
  $("tabConnect").addEventListener("click", () => showPanel("connect"));
  $("tabCode").addEventListener("click", () => showPanel("code"));
  $("tabChat").addEventListener("click", () => showPanel("chat"));
  function openResetModal() {
    $("resetModal").classList.remove("hidden");
  }
  function closeResetModal() {
    $("resetModal").classList.add("hidden");
  }
  async function confirmReset() {
    closeResetModal();
    const res = await sendToOffscreen("resetIdentity");
    if (res && res.ok) {
      activePeer = null;
      trustVerified = false;
      $("chatMessages").textContent = "";
      $("chatPeer").textContent = t("chat.peer");
      $("myPeerId").textContent = res.peerId;
      $("generatedCode").textContent = "\u2014";
      clearInterval(codeCountdownTimer);
      $("codeCountdown").hidden = true;
      renderQr("");
      setStatus(t("status.online"), "online");
      showPanel("connect");
    } else {
      showTempError(errorText(res && res.error) === t("err.sendFailed") ? t("err.resetFailed") : errorText(res && res.error));
    }
  }
  $("resetIdentityBtn").addEventListener("click", openResetModal);
  $("resetCancelBtn").addEventListener("click", closeResetModal);
  $("resetConfirmBtn").addEventListener("click", confirmReset);
  $("panicBtn").addEventListener("click", () => {
    sendToOffscreen("panic", {});
    showDecoy();
  });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "X" || e.key === "x")) {
      sendToOffscreen("panic", {});
      showDecoy();
    }
  });
  function showDecoy() {
    $("loginView").classList.add("hidden");
    $("mainView").classList.add("hidden");
    $("decoyView").hidden = false;
  }
  $("decoyRestartBtn").addEventListener("click", () => {
    $("decoyView").hidden = true;
    sendToOffscreen("resetIdentity", {}).then(() => {
      showView("main");
      showPanel("connect");
    });
  });
  var scanStream = null;
  var scanDetector = null;
  var scanRaf = 0;
  var scanActive = false;
  async function startScan() {
    if (scanActive) return;
    scanActive = true;
    try {
      if (!("BarcodeDetector" in window)) {
        scanActive = false;
        return;
      }
      scanDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (e) {
      scanActive = false;
      showTempError(t("err.cameraDenied"));
      return;
    }
    $("scanModal").classList.remove("hidden");
    $("scanVideo").srcObject = scanStream;
    scanActive = true;
    const tick = () => {
      if (!scanActive) return;
      scanDetector.detect($("scanVideo")).then((codes) => {
        if (codes && codes[0] && codes[0].rawValue) {
          closeScan();
          $("codeInput").value = codes[0].rawValue;
          attemptConnect(codes[0].rawValue);
        } else if (scanActive) {
          scanRaf = requestAnimationFrame(tick);
        }
      }).catch(() => {
        if (scanActive) scanRaf = requestAnimationFrame(tick);
      });
    };
    scanRaf = requestAnimationFrame(tick);
  }
  function closeScan() {
    scanActive = false;
    cancelAnimationFrame(scanRaf);
    if (scanStream) {
      scanStream.getTracks().forEach((t2) => t2.stop());
      scanStream = null;
    }
    $("scanModal").classList.add("hidden");
    const v = $("scanVideo");
    if (v) v.srcObject = null;
  }
  $("scanBtn").addEventListener("click", startScan);
  $("scanCancelBtn").addEventListener("click", closeScan);
  $("scanModal").addEventListener("click", (e) => {
    if (e.target === $("scanModal")) closeScan();
  });
  var screenMasked = false;
  function applyMask(masked) {
    screenMasked = masked;
    const mask = $("screenMask");
    if (mask) mask.hidden = !masked;
  }
  window.addEventListener("blur", () => applyMask(true));
  window.addEventListener("focus", () => applyMask(false));
  document.addEventListener("contextmenu", (e) => {
    if (screenMasked) e.preventDefault();
  });
  $("langSelect").value = getLang();
  applyI18n(document);
  var chatEl = $("chatMessages");
  if (chatEl && chatEl.dataset.empty) chatEl.dataset.empty = t(chatEl.dataset.empty);
  $("langSelect").addEventListener("change", () => {
    setLang($("langSelect").value);
    $("chatMessages").dataset.empty = t("chat.empty");
    $("langSelect").value = getLang();
    applyI18n(document);
    if (activePeer) $("chatPeer").textContent = activePeer;
    renderReadToggle();
    setStatusToConnection();
  });
  setStatus(t("status.offline"));
  initTheme();
  refreshContacts();
  if (!("BarcodeDetector" in window)) $("scanBtn").classList.add("hidden");
  window.addEventListener("beforeunload", teardownCall);
})();
