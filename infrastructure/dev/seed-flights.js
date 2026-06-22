/* eslint-disable */
// Seeds aircraft + flights + seats into the flight-service database.
// WIPES and re-seeds on every run so flight dates are always current
// (today .. today+13), avoiding stale-date issues from earlier runs.
const { PrismaClient } = require('/app/services/flight-service/prisma/generated/client');
const prisma = new PrismaClient();

// Routes seeded (both directions). Includes the webui's default SIN->KUL.
const ROUTES = [
  ['SQ862', 'SIN', 'KUL'],
  ['MH606', 'KUL', 'SIN'],
  ['SQ638', 'SIN', 'CMB'],
  ['UL309', 'CMB', 'SIN'],
  ['EK654', 'DXB', 'CMB'],
  ['UL225', 'CMB', 'DXB'],
  ['SQ448', 'SIN', 'DXB'],
  ['EK432', 'DXB', 'SIN'],
];
const DAYS = 14;                      // today .. today+13
const ROWS = 30;
const COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PRE_BOOKED = ['1A', '1B', '3C', '10D', '15F']; // shown blocked in the grid

function buildSeats(flightId) {
  const seats = [];
  for (let r = 1; r <= ROWS; r++) {
    const cls = r <= 2 ? 'BUSINESS' : r <= 5 ? 'PREMIUM_ECONOMY' : 'ECONOMY';
    for (const c of COLS) {
      const seatNumber = `${r}${c}`;
      seats.push({ flightId, seatNumber, class: cls, isAvailable: !PRE_BOOKED.includes(seatNumber) });
    }
  }
  return seats;
}

async function main() {
  const totalSeats = ROWS * COLS.length;

  // Fresh start: remove existing seats then flights (seats FK -> flights).
  await prisma.seat.deleteMany({});
  await prisma.flight.deleteMany({});

  const aircraft = await prisma.aircraft.upsert({
    where: { registration: '9V-AERO' },
    update: { model: 'Airbus A320neo', totalSeats, seatMap: { rows: ROWS, cols: COLS } },
    create: { registration: '9V-AERO', model: 'Airbus A320neo', totalSeats, seatMap: { rows: ROWS, cols: COLS } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let createdFlights = 0;
  let createdSeats = 0;

  for (let d = 0; d < DAYS; d++) {
    for (const [flightNumber, origin, destination] of ROUTES) {
      const dep = new Date(today);
      dep.setDate(dep.getDate() + d);
      dep.setHours(9, 30, 0, 0);
      const arr = new Date(dep);
      arr.setHours(13, 45, 0, 0);

      const flight = await prisma.flight.create({
        data: {
          flightNumber, origin, destination,
          scheduledDep: dep, scheduledArr: arr,
          status: 'SCHEDULED', aircraftId: aircraft.id,
          gate: 'A1', terminal: 'T1',
          availableSeats: totalSeats - PRE_BOOKED.length,
        },
      });
      const res = await prisma.seat.createMany({ data: buildSeats(flight.id) });
      createdFlights++;
      createdSeats += res.count;
    }
  }

  const first = new Date(today);
  const last = new Date(today); last.setDate(last.getDate() + DAYS - 1);
  console.log(`✅ Re-seeded ${createdFlights} flights and ${createdSeats} seats for ${first.toISOString().slice(0,10)} .. ${last.toISOString().slice(0,10)}.`);
  console.log(`   Routes: ${ROUTES.map(r => r[1] + '→' + r[2]).join(', ')}`);
}

main()
  .catch((e) => { console.error('flight seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
