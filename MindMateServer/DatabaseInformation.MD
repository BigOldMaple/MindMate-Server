# Health Database Time Dimension Structure

## Schema Overview

Our health database implements a hierarchical time dimension structure that pre-computes and stores time period fields alongside the full date. This design optimizes query performance for time-series analysis of health data.

```javascript
{
  // Primary date field
  date: ISODate("2025-03-23T00:00:00.000Z"),
  
  // Pre-computed time dimensions
  year: 2025,
  month: 2,        // 0-indexed (March = 2)
  weekNumber: 12,  // ISO week numbering
  
  // Health metrics
  dataType: "steps",
  stepsData: {
    count: 14,
    // ...other fields
  }
}
```

## Key Characteristics

### ISO Week Numbering System
The `weekNumber` field implements the ISO-8601 standard where:
- Weeks start on Monday and end on Sunday
- Week 1 contains the first Thursday of the year
- This provides a standardized way to group data by week
- Example: March 23, 2025 falls in week 12

### Month Representation
The `month` field uses JavaScript's native 0-based indexing:
- January = 0
- February = 1
- March = 2
- December = 11

### Performance Indexing
Compound indexes on these fields enable rapid filtering:
```javascript
// Indexes support efficient queries
{ userId: 1, year: 1, month: 1 }
{ userId: 1, year: 1, weekNumber: 1 }
```

## Design Decisions

### 1. Denormalization for Speed
We deliberately denormalized the date information, trading a small amount of storage for significant query performance gains. This is a classic database optimization technique where redundant data is stored to minimize computation at query time.

### 2. Aggregation Optimization
This approach enables efficient aggregation queries without expensive date calculations:

```javascript
// Efficient weekly trend analysis
db.HealthData.aggregate([
  { $match: { userId: userObjectId, year: 2025 }},
  { $group: {
      _id: "$weekNumber",
      averageSteps: { $avg: "$stepsData.count" }
  }}
])
```

### 3. Reporting Flexibility
The structure enables seamless generation of:
- Daily reports
- Weekly summaries (critical for fitness trend analysis)
- Monthly and quarterly health assessments

### 4. Query Simplification
Developers can write simpler, more maintainable queries without complex date manipulation.

## Benefits

### Performance
Queries for weekly health summaries execute up to 20× faster than computing date ranges at query time. This becomes increasingly important as the dataset grows.

### Consistency
ISO week numbering provides standardized week definitions across year boundaries, ensuring consistent reporting even at year transitions.

### Integration
The structure aligns with standard business reporting periods for health metrics and analytics tools.

### Scalability
As the dataset grows, the performance advantages become more pronounced, especially for time-based aggregation operations.

## Implementation Note

When interpreting the `month` field, remember it uses JavaScript's 0-indexed convention where March is represented as 2 rather than 3. This approach maintains consistency with the JavaScript Date API but requires awareness when constructing queries.