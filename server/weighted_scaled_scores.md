Final Scaling Logic and Algorithm for 1-150+ Scores

---

Objective: Scale scores from 1-150 to a 0-10 range, and apply weighted capped scaling for values above 150.

Parameters:
- x: Original score
- w: Weight for values above 150 (recommended 0.05)
- y_max: Maximum cap for scaled scores (recommended 12)

Algorithm:

1. If x <= 150 (linear scaling):
   y = x / 15

2. If x > 150 (weighted and capped):
   y = min(10 + w * (x - 150), y_max)

3. Combined logic (piecewise):
   if x <= 150:
       y = x / 15
   else:
       y = min(10 + w * (x - 150), y_max)

4. Optional single formula:
   y = min(x/15 + w * max(x - 150, 0), y_max)

Examples:
- x = 100 -> y = 100 / 15 ≈ 6.67
- x = 150 -> y = 150 / 15 = 10
- x = 160 -> y = min(10 + 0.05 * 10, 12) = 10.5
- x = 200 -> y = min(10 + 0.05 * 50, 12) = 12

Notes:
- Weight (w) controls how much scores above 150 influence the scaled score.
- Cap (y_max) ensures extreme values do not distort the scale.
- Linear scaling ensures 0-150 range is proportional and balanced.

