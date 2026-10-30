/**
 * Excerpt of dse-modbus-gateway/logs/dse.log.
 * Gap-timing lines inside diagnostics are omitted. Values are not edited.
 */
export const DSE_LOG_EXCERPT = `
======== cycle 1/8 ========
Manufacturer Code: 1
Model Number: 32841
Serial Number: unavailable
Operating mode: Auto
Control Unit Status: 1024
Oil pressure: 30 kPa
Coolant temperature: unavailable
Oil temperature: unavailable
Fuel level: 9 %
Charge alternator voltage: 0.0 V
Battery voltage: 13.5 V
Engine RPM: 0 rpm
Frequency: 0.0 Hz
Line 1 voltage: 0.0 V
Line 2 voltage: 0.0 V
Line 3 voltage: unavailable
Line 1-2 voltage: 0.0 V
Line 2-3 voltage: unavailable
Line 3-1 voltage: unavailable
Line 1 current: 6.7 A
Line 2 current: 10.6 A
Line 3 current: unavailable
Line 1 power: 0 W
Line 2 power: 0 W
Line 3 power: unavailable
Mains frequency: 50.2 Hz
Mains L1 voltage: 210.1 V
Mains L2 voltage: 204.4 V
Mains L3 voltage: unavailable
Mains L1-L2 voltage: 364.7 V
Mains L2-L3 voltage: unavailable
Mains L3-L1 voltage: unavailable
BATCH FAIL @1408 qty=1 result=2
Total real power: 0 W
Generator Phase A Apparent Power: 0 VA
Generator Phase B Apparent Power: 0 VA
Generator Phase C Apparent Power: unavailable
Total apparent power: 0 VA
Generator Phase A Reactive Power: 0 VAr
Generator Phase B Reactive Power: 0 VAr
Generator Phase C Reactive Power: unavailable
Total reactive power: 0 VAr
Generator Phase A Power Factor: 0.00
Generator Phase B Power Factor: 0.00
Generator Phase C Power Factor: unavailable
Power factor: unavailable
Load percent: 0.0 %
Engine hours: 4138.81 h
Energy export: 19711.6 kWh
Engine starts: 4184
Alarm page 154: FAIL
Batches OK=6 FAIL=2
LINK: DEGRADED
>
## DSE iterate (all)  slave=1  baud=9600
Manufacturer Code: 1
Model Number: 32841
Serial Number: unimplemented
Operating mode: Auto
Control Unit Status: 1024
Oil pressure: 30 kPa
Coolant temperature: under range
Oil temperature: unimplemented
Fuel level: 9 %
Charge alternator voltage: 0.0 V
Battery voltage: 13.4 V
Engine RPM: 0 rpm
Frequency: 0.0 Hz
Line 1 voltage: 0.0 V
Line 2 voltage: 0.0 V
Line 3 voltage: unimplemented
Line 1-2 voltage: 0.0 V
Line 2-3 voltage: unimplemented
Line 3-1 voltage: unimplemented
Line 1 current: 5.9 A
Line 2 current: 9.0 A
Line 3 current: unimplemented
Line 1 power: 0 W
Line 2 power: 0 W
Line 3 power: unimplemented
Mains frequency: 50.2 Hz
Mains L1 voltage: 218.4 V
Mains L2 voltage: 218.1 V
Mains L3 voltage: unimplemented
Mains L1-L2 voltage: 381.1 V
Mains L2-L3 voltage: unimplemented
Mains L3-L1 voltage: unimplemented
Engine status: unimplemented
Engine State (alt): unimplemented
Total real power: 0 W
Generator Phase A Apparent Power: 0 VA
Generator Phase B Apparent Power: 0 VA
Generator Phase C Apparent Power: unimplemented
Total apparent power: 0 VA
Generator Phase A Reactive Power: 0 VAr
Generator Phase B Reactive Power: 0 VAr
Generator Phase C Reactive Power: unimplemented
Total reactive power: 0 VAr
Generator Phase A Power Factor: 0.00
Generator Phase B Power Factor: 0.00
Generator Phase C Power Factor: unimplemented
Power factor: under range
Load percent: 0.0 %
Engine hours: 4138.81 h
Energy export: 19711.6 kWh
Engine starts: 4184
BATCH FAIL @1357 qty=3 result=1
>
## DSE iterate (all)  slave=1  baud=9600
Manufacturer Code: 1
Model Number: 32841
Serial Number: unimplemented
Operating mode: Manual
Control Unit Status: 1536
Oil pressure: 401 kPa
Coolant temperature: under range
Oil temperature: unimplemented
Fuel level: 9 %
Charge alternator voltage: 14.2 V
Battery voltage: 13.6 V
Engine RPM: 1587 rpm
Frequency: 52.9 Hz
Line 1 voltage: 234.8 V
Line 2 voltage: 234.4 V
Line 3 voltage: unimplemented
Line 1-2 voltage: 406.9 V
Line 2-3 voltage: unimplemented
Line 3-1 voltage: unimplemented
Line 1 current: 4.8 A
Line 2 current: 7.3 A
Line 3 current: unimplemented
Line 1 power: -283 W
Line 2 power: -372 W
Line 3 power: unimplemented
Mains frequency: 50.3 Hz
Mains L1 voltage: 219.7 V
Mains L2 voltage: 218.7 V
Mains L3 voltage: unimplemented
Mains L1-L2 voltage: 382.7 V
Mains L2-L3 voltage: unimplemented
Mains L3-L1 voltage: unimplemented
Engine status: unimplemented
Engine State (alt): unimplemented
Total real power: -454 W
Generator Phase A Apparent Power: 1232 VA
Generator Phase B Apparent Power: 1784 VA
Generator Phase C Apparent Power: unimplemented
Total apparent power: 3016 VA
Generator Phase A Reactive Power: 679 VAr
Generator Phase B Reactive Power: 659 VAr
Generator Phase C Reactive Power: unimplemented
Total reactive power: 1338 VAr
Generator Phase A Power Factor: -0.10
Generator Phase B Power Factor: -0.12
Generator Phase C Power Factor: unimplemented
Power factor: -0.15
Load percent: -2.8 %
Engine hours: 4138.81 h
Energy export: 19711.6 kWh
Engine starts: 4185
Oil level: unimplemented
Coolant level: unimplemented
>
## DSE iterate (all)  slave=1  baud=9600
Manufacturer Code: 1
Model Number: 32841
Serial Number: unimplemented
Operating mode: Auto
Control Unit Status: 1024
Oil pressure: 383 kPa
Coolant temperature: under range
Oil temperature: unimplemented
Fuel level: 9 %
Charge alternator voltage: 14.2 V
Battery voltage: 13.8 V
Engine RPM: 1602 rpm
Frequency: 53.4 Hz
Line 1 voltage: 234.6 V
Line 2 voltage: 234.5 V
Line 3 voltage: unimplemented
Line 1-2 voltage: 406.1 V
Line 2-3 voltage: unimplemented
Line 3-1 voltage: unimplemented
Line 1 current: 4.5 A
Line 2 current: 6.7 A
Line 3 current: unimplemented
Line 1 power: -192 W
Line 2 power: -277 W
Line 3 power: unimplemented
Mains frequency: 50.2 Hz
Mains L1 voltage: 219.7 V
Mains L2 voltage: 217.7 V
Mains L3 voltage: unimplemented
Mains L1-L2 voltage: 381.7 V
Mains L2-L3 voltage: unimplemented
Mains L3-L1 voltage: unimplemented
Engine status: unimplemented
Engine State (alt): unimplemented
Total real power: -640 W
Generator Phase A Apparent Power: 1157 VA
Generator Phase B Apparent Power: 1836 VA
Generator Phase C Apparent Power: unimplemented
Total apparent power: 2993 VA
Generator Phase A Reactive Power: -512 VAr
Generator Phase B Reactive Power: -940 VAr
Generator Phase C Reactive Power: unimplemented
Total reactive power: -1452 VAr
Generator Phase A Power Factor: -0.18
Generator Phase B Power Factor: -0.22
Generator Phase C Power Factor: unimplemented
Power factor: -0.21
Load percent: -4.0 %
Engine hours: 4138.82 h
Energy export: 19711.6 kWh
Engine starts: 4185
Oil level: unimplemented
Coolant level: unimplemented
>
## DSE iterate (all)  slave=1  baud=9600
Manufacturer Code: 1
Model Number: 32841
Serial Number: unimplemented
Operating mode: Auto
Control Unit Status: 1536
Oil pressure: 30 kPa
Coolant temperature: under range
Oil temperature: unimplemented
Fuel level: 9 %
Charge alternator voltage: 0.0 V
Battery voltage: 13.6 V
Engine RPM: 0 rpm
Frequency: 0.0 Hz
Line 1 voltage: 0.0 V
Line 2 voltage: 0.0 V
Line 3 voltage: unimplemented
Line 1-2 voltage: 0.0 V
Line 2-3 voltage: unimplemented
Line 3-1 voltage: unimplemented
Line 1 current: 4.8 A
Line 2 current: 5.5 A
Line 3 current: unimplemented
Line 1 power: 0 W
Line 2 power: 0 W
Line 3 power: unimplemented
Mains frequency: 50.2 Hz
Mains L1 voltage: 219.1 V
Mains L2 voltage: 218.2 V
Mains L3 voltage: unimplemented
Mains L1-L2 voltage: 381.8 V
Mains L2-L3 voltage: unimplemented
Mains L3-L1 voltage: unimplemented
Engine status: unimplemented
Engine State (alt): unimplemented
Total real power: 0 W
Generator Phase A Apparent Power: 0 VA
Generator Phase B Apparent Power: 0 VA
Generator Phase C Apparent Power: unimplemented
Total apparent power: 0 VA
Generator Phase A Reactive Power: 0 VAr
Generator Phase B Reactive Power: 0 VAr
Generator Phase C Reactive Power: unimplemented
Total reactive power: 0 VAr
Generator Phase A Power Factor: 0.00
Generator Phase B Power Factor: 0.00
Generator Phase C Power Factor: unimplemented
Power factor: under range
Load percent: 0.0 %
Engine hours: 4138.83 h
Energy export: 19711.6 kWh
Engine starts: 4185
Oil level: unimplemented
Coolant level: unimplemented
>
TXN #42
Device: DSE 7320 / 7320 MKII
REQUEST fields: slave=1 fc=0x3 addr=0x1000 qty=8
FINAL TX BYTE ARRAY: 01 03 10 00 00 08 40 CC
RX stale bytes: 193
RAW RX: 01 03 10 F6 C0 00 00 FE 00 80 00 07 01 02 00 00 00 00 00 1E 15
RX length: 21
Time to first RX byte: 0 ms
RECEIVED CRC COMBINED: 0x151E
CALCULATED CRC: 0x151E
CRC RESULT: PASS
RESULT: VALID MODBUS RESPONSE
TXN #43
Device: DSE 7320 / 7320 MKII
REQUEST: slave=1 addr=4104 qty=2
FINAL TX BYTE ARRAY: 01 10 10 08 00 02 04 8B 76 74 89 13 51
RX stale bytes: 0
RAW RX: 33 03 75 30 00 1A DA 10
RX length: 8
Time to first RX byte: 305 ms
RECEIVED CRC COMBINED: 0x10DA
CALCULATED CRC: 0x10DA
CRC RESULT: PASS
RESULT: INVALID MODBUS FRAME (CRC)
NOTE: Do NOT treat this as a valid exception.
TXN #44
Device: DSE 7320 / 7320 MKII
REQUEST fields: slave=1 fc=0x3 addr=0x1000 qty=8
FINAL TX BYTE ARRAY: 01 03 10 00 00 08 40 CC
RX stale bytes: 208
RAW RX: 01 03 10 F6 C0 00 00 FE 00 80 00 07 01 02 00 00 00 00 00 1E 15
RX length: 21
Time to first RX byte: 1 ms
RECEIVED CRC COMBINED: 0x151E
CALCULATED CRC: 0x151E
CRC RESULT: PASS
RESULT: VALID MODBUS RESPONSE
TXN #45
Device: DSE 7320 / 7320 MKII
REQUEST: slave=1 addr=4104 qty=2
FINAL TX BYTE ARRAY: 01 10 10 08 00 02 04 8B 79 74 86 63 56
RX stale bytes: 0
RAW RX: 01 03 04 00 00 42 C4 CB 01
RX length: 96
Time to first RX byte: 501 ms
RECEIVED CRC COMBINED: 0x1CB
CALCULATED CRC: 0xCB
CRC RESULT: FAIL
RESULT: INVALID MODBUS FRAME (CRC)
NOTE: Do NOT treat this as a valid exception.
`;
