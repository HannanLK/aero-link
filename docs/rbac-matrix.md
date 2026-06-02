# AeroLink RBAC Matrix

## Roles

| Role ID | Display Name | Description |
|---------|-------------|-------------|
| `CUSTOMER` | Customer | Registered passenger; books, checks in, tracks own baggage |
| `FLIGHT_ATTENDANT` | Flight Attendant | Cabin crew; views manifest, updates cabin status |
| `GATE_AGENT` | Gate Agent | Ground staff; manages boarding, scans baggage, issues gate passes |
| `IMMIGRATION_OFFICER` | Immigration Officer | Views passenger travel documents, flags, and clearance status |
| `AIRLINE_ADMIN` | Airline Admin | Full platform access; manages users, roles, flights, reports |
| `AIRCRAFT_CREW` | Aircraft Crew | Pilots and technical crew; views flight operations data, updates flight status |
| `SERVICE_ACCOUNT` | Service Account | Internal service-to-service calls; not assignable to human users |

Roles are stored in Cognito `custom:roles` attribute as a comma-separated string.
A user may hold multiple roles (e.g. `AIRLINE_ADMIN` also has `CUSTOMER` rights).

---

## Permission Matrix

Legend: ✅ Full access | 🔒 Own records only | 👁 Read-only | ❌ No access

### Identity & Users

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Register / login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View any user profile | ❌ | ❌ | ❌ | 👁 (travel docs only) | ✅ | ❌ |
| Assign / revoke roles | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Delete user account | 🔒 (own) | ❌ | ❌ | ❌ | ✅ | ❌ |
| List all users | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Flights

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Search flights | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View flight details + seat map | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / modify flight | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cancel flight | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Update flight status (delayed/boarding/departed) | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| View flight passenger manifest | ❌ | ✅ | ✅ | 👁 (names only) | ✅ | ✅ |
| Manage aircraft types | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Bookings

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Create booking | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View own booking | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View any booking | ❌ | 👁 (own flight) | ✅ | 👁 (travel context) | ✅ | 👁 (own flight) |
| Cancel own booking | 🔒 | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cancel any booking | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View booking saga status | 🔒 | ❌ | ❌ | ❌ | ✅ | ❌ |

### Payments

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Pay for own booking | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own transaction | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View all transactions | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Issue refund | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Check-in

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Self check-in | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Agent-assisted check-in | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| View own boarding pass | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View any boarding pass | ❌ | ✅ | ✅ | 👁 | ✅ | ❌ |
| Reprint / resend boarding pass | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Close check-in for flight | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |

### Baggage

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| View own baggage status | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Register bag at check-in | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Scan bag (update custody) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Lookup bag by barcode/QR | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| View all bags for flight | ❌ | 👁 | ✅ | ❌ | ✅ | ❌ |

### Observability & Administration

| Action | CUSTOMER | FLIGHT_ATTENDANT | GATE_AGENT | IMMIGRATION_OFFICER | AIRLINE_ADMIN | AIRCRAFT_CREW |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| View CloudWatch dashboards | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Kafka UI | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Argo CD dashboard | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View API documentation (Swagger) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## NestJS RBAC Implementation

Roles are enforced via the `@Roles()` decorator from `@aerolink/common-middleware`:

```typescript
// Example: booking-service controller
@Get(':id')
@Roles('CUSTOMER', 'GATE_AGENT', 'AIRLINE_ADMIN')
async getBooking(
  @Param('id') id: string,
  @CurrentUser() user: JwtPayload,
): Promise<BookingResponseDto> {
  // RolesGuard has already verified role
  // For CUSTOMER: service layer enforces own-records-only by comparing user.sub === booking.passengerId
  return this.bookingService.findById(id, user);
}
```

The `CurrentUser()` decorator extracts the JWT payload injected by API Gateway headers (`x-user-id`, `x-user-roles`). For `🔒 Own records only` enforcement, the service layer compares `user.sub` against the resource owner ID — this is not done in the guard.

---

## Data Classification by Role

| Role | PII Access | PCI-DSS Data | Passport/Immigration |
|------|:---:|:---:|:---:|
| CUSTOMER | Own only | Own transactions only | Own only |
| FLIGHT_ATTENDANT | Name + seat number | ❌ | ❌ |
| GATE_AGENT | Name + booking ref | ❌ | ❌ |
| IMMIGRATION_OFFICER | Name + nationality + document type | ❌ | ✅ (read only) |
| AIRLINE_ADMIN | Full PII | Full transactions | ✅ |
| AIRCRAFT_CREW | Name + seat + flight context | ❌ | ❌ |
