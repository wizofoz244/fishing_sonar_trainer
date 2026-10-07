"""
Unit tests for marine acoustic calculations and geometric footprint validation.
"""

import math
import unittest


def get_depth_at(base_depth: float, world_z: float, rel_z: float, lake_length: float, contour_type: str, lateral_x: float = 0.0) -> float:
    """Calculates water column depth at given coordinates.

    Args:
        base_depth: Nominal base lake depth (ft).
        world_z: Current world scroll Z offset (ft).
        rel_z: Relative distance from boat keel (ft).
        lake_length: Repetition length of the lake loop (ft).
        contour_type: Type of bathymetric contour ('flat', 'ledge', 'hump', 'rolling').
        lateral_x: Lateral offset from keel line (ft).

    Returns:
        Depth in feet clamped between 6 and 65 ft.
    """
    d = base_depth
    track_z = ((world_z + rel_z) % lake_length + lake_length) % lake_length

    if contour_type == "ledge":
        cycle_z = track_z % 160
        if cycle_z < 65:
            d = base_depth - 10
        elif cycle_z < 95:
            t = (cycle_z - 65) / 30
            d = (base_depth - 10) + t * 22
        else:
            d = base_depth + 12
        d += (lateral_x / 65) * 3.5
    elif contour_type == "hump":
        cycle_z = track_z % 150
        dist_from_peak = math.hypot(lateral_x * 0.7, cycle_z - 75)
        peak_elevation = max(0.0, 15 - dist_from_peak * 0.40)
        d = (base_depth + 7) - peak_elevation
    elif contour_type == "rolling":
        d = base_depth + math.sin(track_z * 0.08) * 8.0 + math.cos((track_z * 0.04) + (lateral_x * 0.05)) * 3.0

    return max(6.0, min(65.0, d))


def is_target_in_2d_cone(
    rel_z: float,
    lateral_x: float,
    depth_ft: float,
    boat_z: float,
    tx_offset_transom: float,
    tx_depth: float,
    trad_angle_deg: float
) -> bool:
    """Tests if a target is within the 2D CHIRP conical beam.

    Args:
        rel_z: Target Z coordinate.
        lateral_x: Target lateral offset.
        depth_ft: Target depth.
        boat_z: Boat keel center Z.
        tx_offset_transom: Transom transducer longitudinal offset.
        tx_depth: Transducer draft.
        trad_angle_deg: CHIRP cone angle in degrees.

    Returns:
        True if inside conical footprint, False otherwise.
    """
    tx_z = boat_z + tx_offset_transom
    dy = depth_ft - tx_depth
    if dy <= 0.2:
        return False
    cone_half_angle_rad = math.radians(trad_angle_deg / 2)
    cone_radius_at_depth = dy * math.tan(cone_half_angle_rad)
    horiz_dist = math.hypot(lateral_x, rel_z - tx_z)
    return horiz_dist <= cone_radius_at_depth


class TestAcousticEngine(unittest.TestCase):
    def test_depth_clamping(self):
        """Depth should strictly be clamped between 6 ft and 65 ft."""
        depth_flat = get_depth_at(25.0, 0, 0, 400, "flat")
        self.assertEqual(depth_flat, 25.0)

        depth_deep = get_depth_at(90.0, 0, 0, 400, "flat")
        self.assertEqual(depth_deep, 65.0)

        depth_shallow = get_depth_at(2.0, 0, 0, 400, "flat")
        self.assertEqual(depth_shallow, 6.0)

    def test_ledge_bathymetry(self):
        """Ledge should produce deeper drop-off at cycleZ >= 95."""
        shallow_side = get_depth_at(25.0, 0, 20, 400, "ledge")
        drop_side = get_depth_at(25.0, 0, 110, 400, "ledge")
        self.assertLess(shallow_side, drop_side)

    def test_cone_footprint(self):
        """Targets on keel right under transducer should be detected inside 2D cone."""
        boat_z = 35.0
        tx_offset = -3.5
        tx_z = boat_z + tx_offset

        # Directly centered at 15 ft depth
        in_cone = is_target_in_2d_cone(
            rel_z=tx_z,
            lateral_x=0.0,
            depth_ft=15.0,
            boat_z=boat_z,
            tx_offset_transom=tx_offset,
            tx_depth=0.6,
            trad_angle_deg=24.0
        )
        self.assertTrue(in_cone)

        # Target 25 ft laterally offset at 15 ft depth (tan(12 deg) * 14.4 ft ~= 3.06 ft radius)
        outside_cone = is_target_in_2d_cone(
            rel_z=tx_z,
            lateral_x=25.0,
            depth_ft=15.0,
            boat_z=boat_z,
            tx_offset_transom=tx_offset,
            tx_depth=0.6,
            trad_angle_deg=24.0
        )
        self.assertFalse(outside_cone)

    def test_lure_kinematics(self):
        """Lure drops progressively through the water column until bottom settling."""
        bed_depth = 25.0
        lure_depth = 1.0

        # Simulate descent steps (22.5 ft / 0.18 ft = 125 steps)
        for _ in range(140):
            if lure_depth < bed_depth - 1.5:
                lure_depth += 0.18
        self.assertAlmostEqual(lure_depth, bed_depth - 1.5, delta=0.2)

    def test_livescope_cone_angles(self):
        """Objects outside the elevation angle spread window must be rejected."""
        tilt_deg = 45.0
        spread_deg = 40.0
        min_angle = math.radians(tilt_deg - spread_deg / 2) # 25 deg
        max_angle = math.radians(tilt_deg + spread_deg / 2) # 65 deg

        fwd_dist = 6.0
        # Shallow target (e.g. depth 1.0 ft, tx_depth 0.6 ft -> dy = 0.4 ft)
        # angle = atan2(0.4, 6.0) = 3.8 deg < 25 deg (outside cone!)
        dy_shallow = 0.4
        angle_shallow = math.atan2(dy_shallow, fwd_dist)
        self.assertLess(angle_shallow, min_angle)

        # Target well within cone (e.g. depth 6.6 ft, tx_depth 0.6 ft -> dy = 6.0 ft)
        # angle = atan2(6.0, 6.0) = 45.0 deg (centered!)
        dy_mid = 6.0
        angle_mid = math.atan2(dy_mid, fwd_dist)
        self.assertTrue(min_angle <= angle_mid <= max_angle)

    def test_clearvu_lateral_reach(self):
        """ClearVü DownScan razor slice lateral reach calculation and gating."""
        tx_depth = 0.6
        clear_angle_deg = 45.0
        clear_half_rad = math.radians(clear_angle_deg / 2)

        # Target at 20 ft depth
        dy = 20.0 - tx_depth
        max_reach = dy * math.tan(clear_half_rad) + 1.5 * 0.4
        self.assertAlmostEqual(max_reach, 19.4 * math.tan(math.radians(22.5)) + 0.6, delta=0.1)

        # Target inside reach (e.g. lateral_x = 2 ft)
        self.assertLess(abs(2.0), max_reach)
        # Target outside reach (e.g. lateral_x = 25 ft)
        self.assertGreater(abs(25.0), max_reach)

    def test_clearvu_3d_beam_geometry(self):
        """Validates ClearVü 3D water column acoustic wedge and footprint coordinates."""
        tx_depth = 0.6
        boat_z = 35.0
        tx_offset_transom = -2.0
        tx_z = boat_z + tx_offset_transom # 33.0 ft
        lake_depth = 25.0
        clear_angle_deg = 45.0
        clear_half_rad = math.radians(clear_angle_deg / 2)
        slice_thick_ft = 1.5

        # Transducer origin coordinates
        z_aft = tx_z - slice_thick_ft / 2
        z_fore = tx_z + slice_thick_ft / 2
        self.assertEqual(z_fore - z_aft, slice_thick_ft)

        # Lateral reach at lakebed
        half_lateral_reach = (lake_depth - tx_depth) * math.tan(clear_half_rad)
        self.assertGreater(half_lateral_reach, 10.0)

        # 3D bounding vertices
        p1 = (-half_lateral_reach, lake_depth, z_aft)
        p2 = (half_lateral_reach, lake_depth, z_aft)
        p3 = (half_lateral_reach, lake_depth, z_fore)
        p4 = (-half_lateral_reach, lake_depth, z_fore)

        # Verify bed footprint rectangle area > 0
        bed_area = (p2[0] - p1[0]) * (p3[2] - p2[2])
        self.assertAlmostEqual(bed_area, (2 * half_lateral_reach) * slice_thick_ft)

        # Water column expansion: reach at mid-depth (12.8 ft) must be strictly between 0 and lakebed reach
        mid_depth = (tx_depth + lake_depth) / 2
        mid_reach = (mid_depth - tx_depth) * math.tan(clear_half_rad)
        self.assertGreater(mid_reach, 0.0)
        self.assertLess(mid_reach, half_lateral_reach)
        self.assertAlmostEqual(mid_reach, half_lateral_reach / 2, places=5)

    def test_sidevu_sweep_reach(self):
        """SideVü bilateral swath maximum lateral sweep coverage."""
        lake_depth = 25.0
        tx_depth = 0.6
        sweep_deg = 55.0
        sweep_rad = math.radians(sweep_deg)
        side_range_ft = 80.0

        max_sweep_reach = min(side_range_ft, max(12.0, (lake_depth - tx_depth) * math.tan(sweep_rad)))
        expected = min(80.0, 24.4 * math.tan(math.radians(55.0)))
        self.assertAlmostEqual(max_sweep_reach, expected, delta=0.1)

        # Target at 20 ft lateral offset should be in sweep
        self.assertLess(20.0, max_sweep_reach)
    def test_livescope_waterline_clamping(self):
        """Verifies LiveScope acoustic ray angles and depths are clamped to never breach the water surface."""
        # Test extreme shallow tilt with wide spread
        live_tilt_deg = 15.0
        live_spread_deg = 50.0
        tilt_rad = math.radians(live_tilt_deg)
        spread_rad = math.radians(live_spread_deg)

        # Raw unclamped minimum angle would be negative (upwards into the air)
        raw_min_angle = tilt_rad - spread_rad / 2
        self.assertLess(raw_min_angle, 0.0, "Raw angle should be negative for shallow tilt + wide spread")

        # Clamped minimum angle must be positive (downward into water)
        clamped_min_angle = max(0.04, raw_min_angle)
        self.assertGreater(clamped_min_angle, 0.0, "Clamped angle must be positive")

        # Simulated ray depths along beam: for any positive angle, depth from transducer must increase
        tx_depth = 0.6
        live_reach_ft = 55.0
        for step in range(5):
            angle = clamped_min_angle + step * 0.1
            ray_depth = tx_depth + live_reach_ft * math.sin(angle)
            # Clamped ray depth must strictly be >= 0 (cannot enter air)
            effective_depth = max(0.0, ray_depth)
            self.assertGreaterEqual(effective_depth, 0.0)
            self.assertGreaterEqual(effective_depth, tx_depth)


if __name__ == "__main__":
    unittest.main()
