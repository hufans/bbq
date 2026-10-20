cask "bbq" do
  arch arm: "arm64", intel: "x64"

  # FILL AT FIRST RELEASE. 0.0.0 is not a published BBQ build.
  version "0.0.0"
  # SHA256 of the empty string, not of a disk image. brew install fails
  # closed until this is the digest of bbq-macos-*.dmg from hufans/bbq.
  # Do not paste an Orca digest here.
  sha256 arm:   "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
         intel: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  url "https://github.com/hufans/bbq/releases/download/v#{version}/bbq-macos-#{arch}.dmg"
  name "BBQ"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://github.com/hufans/bbq"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  conflicts_with cask: "bbq@rc"
  depends_on macos: :big_sur

  app "BBQ.app"
  binary "#{appdir}/BBQ.app/Contents/Resources/bin/bbq"

  # ~/.orca is left in place. The app copies missing files out of it once.
  zap trash: [
    "~/.bbq",
    "~/Library/Application Support/BBQ",
    "~/Library/Caches/com.hufans.bbq",
    "~/Library/Caches/com.hufans.bbq.ShipIt",
    "~/Library/HTTPStorages/com.hufans.bbq",
    "~/Library/Logs/BBQ",
    "~/Library/Preferences/com.hufans.bbq.plist",
    "~/Library/Saved Application State/com.hufans.bbq.savedState",
  ]
end
