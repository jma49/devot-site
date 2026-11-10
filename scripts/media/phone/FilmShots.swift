import DevotScreens
import XCTest

/// Shots of the installed Devot app for the film, one per test: `pnpm media:phone shot <id>` copies
/// this file into Devot's UI tests, records the simulator's screen while one test runs and cuts the
/// recording to the test's own start and end. A test brings the app to the shot's first frame,
/// then plays it with a still moment on either side and names its steps as beats.
///
/// FILM_OUT is the folder for the shot's note (`<id>-<scheme>.json`) and its still
/// (`<id>-<scheme>.png`), FILM_SCHEME the colour scheme the simulator is in. xcodebuild passes
/// both to the test runner as TEST_RUNNER_FILM_OUT and TEST_RUNNER_FILM_SCHEME.
@MainActor
final class FilmShots: XCTestCase {
    private var app: XCUIApplication!
    private var shot = ""
    private var began = Date()
    private var beats: [[String: Any]] = []

    private var out: URL {
        URL(fileURLWithPath: ProcessInfo.processInfo.environment["FILM_OUT"] ?? NSTemporaryDirectory())
    }
    private var scheme: String { ProcessInfo.processInfo.environment["FILM_SCHEME"] ?? "light" }

    private var tabBar: XCUIElement { app.tabBars.firstMatch }
    private var page: XCUIElement { app.webViews.firstMatch }
    private var list: XCUIElement { app.collectionViews.firstMatch }
    /// The note's own bar, told from a list's by its Info button.
    private var noteBar: XCUIElement {
        app.navigationBars.containing(NSPredicate(format: "label == %@", L10n.phoneInfoTitle())).firstMatch
    }

    private func launch() {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "io.github.jma49.devot")
        app.launch()
        XCTAssertTrue(tabBar.waitForExistence(timeout: 120))
    }

    private func pause(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    private func waitUntil(_ condition: () -> Bool, timeout: TimeInterval = 10) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline { pause(0.1) }
        return condition()
    }

    private func tab(_ name: String) {
        let item = tabBar.buttons[name]
        XCTAssertTrue(item.waitForExistence(timeout: 10), name)
        item.tapOnceHittable()
    }

    private func row(_ title: String) -> XCUIElement {
        app.collectionViews.cells.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
    }

    private func open(_ title: String) {
        let note = row(title)
        XCTAssertTrue(note.waitForExistence(timeout: 30), "\(title) is listed")
        XCTAssertTrue(waitUntil { note.isHittable }, "\(title) is on screen")
        note.tap()
        XCTAssertTrue(noteBar.waitForExistence(timeout: 10), "the row pushes its note")
        XCTAssertTrue(app.otherElements["editor.cover"].waitForNonExistence(timeout: 10), "the cover fades")
    }

    /// The shot starts here: everything before is setup and is cut away.
    private func start(_ id: String) {
        shot = id
        pause(0.6)
        beats = []
        began = Date()
        pause(1.0)
    }

    /// A named step, with the point on the screen it touches when there is one, in points.
    private func beat(_ what: String, at element: XCUIElement? = nil) {
        var entry: [String: Any] = ["t": (Date().timeIntervalSince(began) * 100).rounded() / 100, "what": what]
        if let frame = element?.frame, !frame.isEmpty {
            entry["x"] = frame.midX.rounded()
            entry["y"] = frame.midY.rounded()
        }
        beats.append(entry)
    }

    private func tap(_ element: XCUIElement, _ what: String) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), what)
        XCTAssertTrue(waitUntil { element.isHittable }, what)
        beat(what, at: element)
        element.tap()
    }

    /// A finger's drag up or down the middle of `element`, slow enough to read by, with no fling.
    private func drag(_ element: XCUIElement, from: CGFloat, to: CGFloat, _ what: String) {
        beat(what, at: element)
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: from)).press(
            forDuration: 0.05, thenDragTo: element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: to)),
            withVelocity: XCUIGestureVelocity(rawValue: 380), thenHoldForDuration: 0.25)
    }

    /// The screen as it is now, kept as the shot's still.
    private func still() {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        try? png.write(to: out.appendingPathComponent("\(shot)-\(scheme).png"))
    }

    private func finish() throws {
        pause(1.0)
        let note: [String: Any] = [
            "id": shot, "scheme": scheme, "start": began.timeIntervalSince1970,
            "end": Date().timeIntervalSince1970, "beats": beats,
            "points": [app.frame.width, app.frame.height],
        ]
        let data = try JSONSerialization.data(withJSONObject: note, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: out.appendingPathComponent("\(shot)-\(scheme).json"))
    }

    func testP1Notes() throws {
        launch()
        tab(L10n.phoneTabNotes())
        XCTAssertTrue(row("Spring launch plan").waitForExistence(timeout: 30))
        start("p1-notes")
        still()
        drag(list, from: 0.75, to: 0.3, "scroll the list up")
        pause(0.8)
        drag(list, from: 0.6, to: 0.25, "scroll further")
        pause(1.0)
        drag(list, from: 0.3, to: 0.75, "scroll back")
        pause(0.4)
        drag(list, from: 0.3, to: 0.9, "back to the top")
        try finish()
    }

    func testP2Read() throws {
        launch()
        tab(L10n.phoneTabNotes())
        XCTAssertTrue(row("Spring launch plan").waitForExistence(timeout: 30))
        start("p2-read")
        tap(row("Spring launch plan"), "open Spring launch plan")
        XCTAssertTrue(app.otherElements["editor.cover"].waitForNonExistence(timeout: 10))
        pause(1.4)
        drag(page, from: 0.7, to: 0.3, "scroll past the goals")
        pause(1.0)
        still()
        drag(page, from: 0.7, to: 0.3, "scroll past the table")
        pause(1.0)
        drag(page, from: 0.7, to: 0.35, "scroll to the tasks")
        try finish()
    }

    func testP3Edit() throws {
        launch()
        tab(L10n.phoneTabNotes())
        open("Weekly review, week 43")
        start("p3-edit")
        tap(noteBar.buttons[L10n.phoneNoteEdit()], "switch to Edit")
        pause(0.8)
        // The last line of the note, where a tap leaves the caret.
        let last = page.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Bake the focaccia")).firstMatch
        if last.exists {
            beat("tap the last task", at: last)
            last.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)).tap()
        } else {
            beat("tap the note", at: page)
            page.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.55)).tap()
        }
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "the tap raises the keyboard")
        pause(0.5)
        beat("type a line")
        for character in "\nBook the train to the coast" {
            app.typeText(String(character))
            pause(0.05)
        }
        pause(0.8)
        still()
        tap(app.otherElements["devot.formatting"].buttons[L10n.phoneNoteHideKeyboard()], "hide the keyboard")
        pause(0.6)
        tap(noteBar.buttons[L10n.phoneNotePreview()], "switch to Preview")
        pause(0.8)
        let task = page.switches.firstMatch.exists ? page.switches.firstMatch : page.checkBoxes.firstMatch
        tap(task, "tick a task")
        try finish()
    }

    func testP4Search() throws {
        launch()
        tab(L10n.phoneTabNotes())
        XCTAssertTrue(row("Spring launch plan").waitForExistence(timeout: 30))
        start("p4-search")
        tap(tabBar.buttons[L10n.phoneTabSearch()], "open Search")
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        pause(0.5)
        beat("type launch", at: field)
        for character in "launch" {
            field.typeText(String(character))
            pause(0.09)
        }
        let found = row("Spring launch plan")
        XCTAssertTrue(found.waitForExistence(timeout: 15), "the results list the plan")
        pause(1.2)
        still()
        tap(found, "open a result")
        XCTAssertTrue(app.otherElements["editor.cover"].waitForNonExistence(timeout: 10))
        pause(1.2)
        try finish()
    }

    func testP5Library() throws {
        launch()
        tab(L10n.phoneTabLibrary())
        let notebook = row("Journal")
        XCTAssertTrue(notebook.waitForExistence(timeout: 30), "Library lists the notebooks")
        start("p5-library")
        still()
        pause(0.8)
        tap(notebook, "open the Journal notebook")
        XCTAssertTrue(row("Weekly review, week 43").waitForExistence(timeout: 10), "the notebook lists its notes")
        pause(2.0)
        try finish()
    }

    func testP6Activity() throws {
        launch()
        tab(L10n.phoneTabNotes())
        start("p6-activity")
        tap(tabBar.buttons[L10n.phoneTabActivity()], "open Activity")
        let activity = app.collectionViews["activity.list"]
        XCTAssertTrue(activity.waitForExistence(timeout: 10))
        XCTAssertTrue(activity.images.firstMatch.waitForExistence(timeout: 30), "the heatmap is drawn")
        pause(1.6)
        still()
        drag(activity, from: 0.7, to: 0.45, "scroll a little")
        pause(1.0)
        drag(activity, from: 0.45, to: 0.7, "scroll back")
        try finish()
    }

    func testP7NewNote() throws {
        launch()
        tab(L10n.phoneTabNotes())
        let newNote = app.navigationBars.buttons[L10n.noteListNewNote()]
        XCTAssertTrue(newNote.waitForExistence(timeout: 30))
        start("p7-new-note")
        tap(newNote, "New Note")
        XCTAssertTrue(noteBar.waitForExistence(timeout: 10), "New Note pushes the editor")
        XCTAssertTrue(app.otherElements["editor.cover"].waitForNonExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "the body takes the caret")
        pause(0.6)
        let title = app.textFields[L10n.phoneNoteTitle()]
        if title.exists && title.isHittable {
            tap(title, "tap the title")
            beat("type the title")
            for character in "Offsite ideas" {
                app.typeText(String(character))
                pause(0.06)
            }
            pause(0.4)
            beat("tap the body", at: page)
            page.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).tap()
            pause(0.4)
        }
        beat("type two lines")
        for character in "A long walk before lunch\nOne talk each, ten minutes" {
            app.typeText(String(character))
            pause(0.05)
        }
        pause(0.8)
        still()
        try finish()
    }

    func testP8Settings() throws {
        launch()
        tab(L10n.phoneTabNotes())
        start("p8-settings")
        tap(tabBar.buttons[L10n.phoneTabSettings()], "open Settings")
        XCTAssertTrue(app.navigationBars[L10n.settingsTitle()].waitForExistence(timeout: 10))
        pause(0.8)
        // A Settings row is a button whose label starts with the pane's name.
        let appearance = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", L10n.settingsPaneAppearance())
        ).firstMatch
        tap(appearance, "open Appearance")
        XCTAssertTrue(app.navigationBars[L10n.settingsPaneAppearance()].waitForExistence(timeout: 10))
        pause(1.0)
        let sage = L10n.appearanceSettingsThemeSage()
        let tide = L10n.appearanceSettingsThemeTide()
        let swatch = { (theme: String) -> XCUIElement in
            self.scheme == "dark"
                ? self.app.buttons[L10n.phoneSettingsAppearanceThemeDark(theme: theme)]
                : self.app.buttons[L10n.phoneSettingsAppearanceThemeLight(theme: theme)]
        }
        tap(swatch(sage), "choose Sage")
        pause(1.4)
        tap(swatch(tide), "back to Tide")
        pause(1.0)
        let gradient = app.sliders[L10n.appearanceSettingsGradient()]
        if !gradient.exists || !gradient.isHittable {
            drag(app.collectionViews.firstMatch.exists ? app.collectionViews.firstMatch : app.scrollViews.firstMatch,
                 from: 0.7, to: 0.4, "scroll to Gradient")
            pause(0.6)
        }
        XCTAssertTrue(gradient.waitForExistence(timeout: 5), "Appearance has the Gradient slider")
        beat("drag Gradient to full", at: gradient)
        gradient.coordinate(withNormalizedOffset: CGVector(dx: 0.04, dy: 0.5)).press(
            forDuration: 0.1, thenDragTo: gradient.coordinate(withNormalizedOffset: CGVector(dx: 0.96, dy: 0.5)),
            withVelocity: XCUIGestureVelocity(rawValue: 160), thenHoldForDuration: 0.3)
        pause(1.0)
        still()
        try finish()
    }

    /// For the shot of both devices: the app stays as it is, on the note already open, and one task
    /// is ticked. The Mac's window is in the same recording.
    func testX2TickATask() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "io.github.jma49.devot")
        app.activate()
        XCTAssertTrue(noteBar.waitForExistence(timeout: 20), "a note is open")
        start("x2-iphone-to-mac")
        let boxes = page.switches.count > 0 ? page.switches : page.checkBoxes
        let unticked = boxes.matching(NSPredicate(format: "value == %@ OR value == nil", "0")).firstMatch
        tap(unticked.exists ? unticked : boxes.firstMatch, "tick a task")
        try finish()
    }
}
