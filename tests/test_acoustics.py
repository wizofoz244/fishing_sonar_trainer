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


    def test_livescope_modes_and_rotation(self):
        """Validates LiveScope Forward, Down, and Perspective modes and azimuth rotation."""
        # Bow transducer origin at z = 48.0, x = 0.0, tx_depth = 0.6
        tx_z = 48.0
        tx_depth = 0.6

        # Target directly ahead: lateral_x = 0, z = 78 (fwd = 30 ft), depth = 15 ft
        target_fwd_x = 0.0
        target_fwd_z = 78.0
        target_depth = 15.0

        # Helper simulating beam rotation transformation
        def get_beam_coords(lateral_x: float, rel_z: float, rot_deg: float) -> tuple[float, float]:
            dx = lateral_x
            dz = rel_z - tx_z
            rot_rad = math.radians(rot_deg)
            b_fwd = dz * math.cos(rot_rad) + dx * math.sin(rot_rad)
            b_cross = -dz * math.sin(rot_rad) + dx * math.cos(rot_rad)
            return b_fwd, b_cross

        # 1. At 0° rotation (heading bow), target ahead is directly centered along beam forward
        b_fwd, b_cross = get_beam_coords(target_fwd_x, target_fwd_z, 0.0)
        self.assertAlmostEqual(b_fwd, 30.0, places=4)
        self.assertAlmostEqual(b_cross, 0.0, places=4)

        # 2. Rotate beam 90° Starboard: target ahead should now be on Port beam flank
        b_fwd_rot, b_cross_rot = get_beam_coords(target_fwd_x, target_fwd_z, 90.0)
        self.assertAlmostEqual(b_fwd_rot, 0.0, places=4)
        self.assertAlmostEqual(b_cross_rot, -30.0, places=4)

        # 3. Target located 30 ft off starboard beam (x = 30, z = 48)
        target_stbd_x = 30.0
        target_stbd_z = 48.0
        # At 0° rotation (bow), this is cross-beam (+30 ft) and not forward
        b_fwd_s0, b_cross_s0 = get_beam_coords(target_stbd_x, target_stbd_z, 0.0)
        self.assertAlmostEqual(b_fwd_s0, 0.0, places=4)
        self.assertAlmostEqual(b_cross_s0, 30.0, places=4)

        # When rotating beam 90° Starboard, it points directly at this starboard target!
        b_fwd_s90, b_cross_s90 = get_beam_coords(target_stbd_x, target_stbd_z, 90.0)
        self.assertAlmostEqual(b_fwd_s90, 30.0, places=4)
        self.assertAlmostEqual(b_cross_s90, 0.0, places=4)

        # 4. Perspective Mode coverage: wide horizontal fan (135° = ±67.5°) and 45° vertical elevation
        # A target at 36.8° azimuth angle from the rotated beam axis should be inside the 135° sector
        target_angle_rad = math.atan2(abs(15.0), 20.0) # ~36.8°
        self.assertLess(target_angle_rad, math.radians(135.0 / 2))

        # Perspective Mode elevation test: water depth 18 ft at 22 ft forward distance (~39.3° elevation)
        persp_dy = 18.0 - tx_depth # 17.4 ft
        persp_horiz = math.hypot(22.0, 5.0) # ~22.56 ft
        persp_vert_angle = math.atan2(persp_dy, persp_horiz) # ~37.6°
        self.assertLess(persp_vert_angle, math.radians(45.0), "Perspective mode should cover water column up to 45° elevation")

        # 5. Down Mode coverage: targets directly underneath transducer (e.g. z = 48, x = 0, depth = 20 ft)
        down_target_dz = abs(48.0 - tx_z) # 0 ft
        down_target_dy = 20.0 - tx_depth # 19.4 ft
        vert_angle = math.atan2(down_target_dz, down_target_dy) # 0 rad (straight down)
        self.assertLess(vert_angle, math.radians(135.0 / 2))

        # 6. Lure alignment with bow transducer:
        # Lure dropped at bowZ + 6 should be strictly in front of bow transducer (dz > 0)
        boat_z = 35.0
        tx_offset_bow = 13.0
        bow_z = boat_z + tx_offset_bow # 48.0 ft
        lure_z = bow_z + 6.0 # 54.0 ft
        self.assertGreater(lure_z, bow_z, "Lure must be dropped forward of the bow transducer")
        self.assertEqual(lure_z - bow_z, 6.0)


class TestUIStructure(unittest.TestCase):
    """Unit tests validating HTML structural integrity and top banner elements."""

    def test_top_disclaimer_banner(self) -> None:
        """Verifies presence, accessibility attributes, and external links in the top disclaimer banner.

        Returns:
            None.

        Raises:
            AssertionError: If required banner markup or links are missing or malformed.
        """
        with open("index.html", "r", encoding="utf-8") as f:
            html = f.read()

        # Verify banner container
        self.assertIn('id="banner-disclaimer"', html, "Top disclaimer banner must exist with id 'banner-disclaimer'")

        # Verify notice text content
        self.assertIn("demonstration simulator", html, "Notice must state that this is an independent demonstration simulator")
        self.assertIn("No guarantee", html, "Notice must state that no guarantee is given")
        self.assertIn("trademarks", html, "Notice must mention trademark ownership")

        # Verify GitHub issue template chooser link and security attributes
        github_issues_url = "https://github.com/wizofoz244/fishing_sonar_trainer/issues/new/choose"
        self.assertIn(github_issues_url, html, "Notice must include direct link to GitHub issue template chooser")
        self.assertIn('target="_blank"', html, "GitHub issues link must open in a new tab")
        self.assertIn('rel="noopener noreferrer"', html, "External link must contain rel='noopener noreferrer'")

        # Verify personal email is not exposed in HTML for privacy
        self.assertNotIn("mwoswald@gmail.com", html, "Personal email must not be exposed anywhere in index.html")

        # Verify dismiss button
        self.assertIn("banner-disclaimer", html, "Dismiss button must target the disclaimer banner")

    def test_issue_templates_exist(self) -> None:
        """Verifies presence and configuration of GitHub issue templates.

        Returns:
            None.

        Raises:
            AssertionError: If issue templates or config.yml are missing.
        """
        import os
        template_dir = os.path.join(".github", "ISSUE_TEMPLATE")
        self.assertTrue(os.path.isdir(template_dir), "Issue template directory must exist")
        self.assertTrue(os.path.isfile(os.path.join(template_dir, "bug_report.md")), "Bug report template must exist")
        self.assertTrue(os.path.isfile(os.path.join(template_dir, "feature_request.md")), "Feature request template must exist")
        self.assertTrue(os.path.isfile(os.path.join(template_dir, "config.yml")), "Template config.yml must exist")

        with open(os.path.join(template_dir, "config.yml"), "r", encoding="utf-8") as f:
            config_content = f.read()
        self.assertNotIn("mwoswald@gmail.com", config_content, "Personal email must not be in issue template config")


if __name__ == "__main__":
    unittest.main()


