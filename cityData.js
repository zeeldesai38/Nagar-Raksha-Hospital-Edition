/**
 * Nagar-Raksha (Graceful Degradation Planner)
 * Cyber Samvad Hackathon 2026 - Problem Statement 4: Smart City and Critical Infrastructure Cybersecurity
 * 
 * Simulated City Assets, Baseline Trusted Configurations, and Attack Scenarios
 * SIMULATION ONLY: No real devices or external networks connected.
 */

// Pure JavaScript SHA-256 implementation (Works offline, file://, and within secure contexts)
function computeSHA256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii[lengthProperty]; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] || 0;
      const w2 = w[i - 2] || 0;

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16) ? (w[i] || 0) : ((w[i - 16] + s0 + w[i - 7] + s1) | 0);

      const s1Final = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ ((~hash[4]) & hash[6]);
      const temp1 = (hash[7] + s1Final + ch + k[i] + w[i]) | 0;
      const s0Final = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0Final + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// 6 City Assets strictly matching specification
const INITIAL_ASSETS = [
  {
    id: "TS-01",
    name: "Hospital Signal",
    zone: "Zone A",
    service: "traffic",
    criticality: 5,
    people: 40000,
    note: "Controls the ambulance route to the hospital",
    fallback: "Fixed-timer mode",
    serviceKept: 60,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      cycleSeconds: 60,
      isolatedFromNetwork: true,
      emergencyOverride: "Local Loop Detector",
      firmwareSignature: "TS01-FT-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  },
  {
    id: "WP-01",
    name: "Hospital Water Pump",
    zone: "Zone A",
    service: "water",
    criticality: 5,
    people: 40000,
    note: "Supplies the hospital",
    fallback: "Manual control",
    serviceKept: 80,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      pressurePsi: 65,
      analogPressureValve: true,
      manualGovernorEngaged: true,
      firmwareSignature: "WP01-MC-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  },
  {
    id: "WS-01",
    name: "Residential Water Sensor",
    zone: "Zone C",
    service: "water",
    criticality: 3,
    people: 60000,
    note: "Monitors water for homes",
    fallback: "Last-known-good readings, manual pump",
    serviceKept: 70,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      cachedPurityIndex: 94.2,
      samplingRateMin: 15,
      failoverTelemetry: "Offline Buffer",
      firmwareSignature: "WS01-LKG-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  },
  {
    id: "TS-02",
    name: "Market Signal",
    zone: "Zone B",
    service: "traffic",
    criticality: 3,
    people: 25000,
    note: "Controls central market arterial intersection",
    fallback: "Fixed-timer mode",
    serviceKept: 60,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      cycleSeconds: 75,
      isolatedFromNetwork: true,
      pedestrianWindow: 20,
      firmwareSignature: "TS02-FT-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  },
  {
    id: "SL-02",
    name: "Market Street Lights",
    zone: "Zone B",
    service: "lighting",
    criticality: 1,
    people: 25000,
    note: "Illuminates pedestrian market and bus concourse",
    fallback: "Scheduled mode",
    serviceKept: 90,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      duskHour: 18,
      dawnHour: 6,
      ambientPhotocell: true,
      firmwareSignature: "SL02-SCH-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  },
  {
    id: "MS-01",
    name: "Metro Info Server",
    zone: "Zone D",
    service: "transport",
    criticality: 2,
    people: 30000,
    note: "Displays transit schedules and platform safety warnings",
    fallback: "Static timetable page",
    serviceKept: 50,
    level: 100,
    mode: "Normal",
    fallbackConfig: {
      staticCachePath: "/var/www/static-timetable.html",
      refreshIntervalMin: 60,
      remoteSyncDisabled: true,
      firmwareSignature: "MS01-ST-SAFE-V1"
    },
    trustedCopy: {
      version: "v1",
      hash: "",
      status: "Verified"
    }
  }
];

// Initialize baseline hashes for all assets at startup
INITIAL_ASSETS.forEach(asset => {
  const configString = JSON.stringify(asset.fallbackConfig);
  asset.trustedCopy.hash = computeSHA256(configString);
  asset.baselineCleanConfig = JSON.parse(configString); // Stored clean golden master backup
  asset.baselineCleanHash = asset.trustedCopy.hash;
});

// Three simulated attack scenarios
const SIMULATED_ATTACKS = [
  {
    id: "A1",
    assetId: "TS-01",
    threat: "Unauthorised commands altering signal timings",
    severity: 5,
    urgency: 5,
    technicalDetails: "Forged SCADA NTCIP packets injecting conflicting green sequences on ambulance corridor. High risk of multi-vehicle crash.",
    responsibleDept: "Traffic Control Dept & Emergency Services"
  },
  {
    id: "A2",
    assetId: "WS-01",
    threat: "Sensor sending impossible readings",
    severity: 3,
    urgency: 3,
    technicalDetails: "Sensor telemetry telemetry corrupted with 800 PSI spikes. Attack aims to trigger erratic shutoff valve cycles in residential zone.",
    responsibleDept: "Municipal Water Works & Quality Division"
  },
  {
    id: "A3",
    assetId: "SL-02",
    threat: "Repeated failed login attempts",
    severity: 1,
    urgency: 1,
    technicalDetails: "Dictionary brute-force on remote lighting telemetry gateway. No breach into control plane confirmed.",
    responsibleDept: "Urban Electrical Infrastructure Operations"
  }
];

// Export to window if in browser environment or module.exports if in node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeSHA256, INITIAL_ASSETS, SIMULATED_ATTACKS };
}
