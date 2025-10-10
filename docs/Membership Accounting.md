# Membership Accounting

This document describes how Spaceport handles membership dues and calculates expiry dates and member statuses.

## Theory

Every night or when someone's Member database model is updated, their membership dues get accounted for. The portal filters all their transactions since and including their `start_date` and sums up the `number_of_membership_months` field on those transactions.

This gives a total number of months that they've paid for. That number is simply added to their `start_date` to determine their `expire_date`. The difference between today's date and their `expire_date` is what determines their status:

- Prepaid (green): 30+ days ahead
- Current (green): 1-29 days ahead
- Due (yellow): 0-29 days behind
- Overdue (red): 30d-3m behind
- Expired (black): 3+ months behind

For Directors and admins, all this accounting is broken down for each member in their Member > Admin > Accounting page.

## Caveats

### Vacations

Vacation accounting is not handled by the system. If a member pays for 12 months at a time, then six months later goes on vacation for a year, the system doesn't track that they still have 6 months credit when they return.

When they get unpaused, their `start_date` moves up to today, so the big 12-month transaction won't be included in the filter. The solution is to create a $0.00 Membership Adjustment transaction for today to credit them with their remaining 6 months.

### Paused / Expired

There's not much difference in the system between members who are paused (on vacation) or expired. The difference is mostly aesthetic in whether their membership status says "Paused" or "Expired".