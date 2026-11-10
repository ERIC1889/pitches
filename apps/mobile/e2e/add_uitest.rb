require 'xcodeproj'
proj_path, src_path = ARGV
project = Xcodeproj::Project.open(proj_path)
app = project.targets.find { |t| t.name == 'Pitches' }
project.targets.select { |t| t.name == 'PitchesUITests' }.each(&:remove_from_project)
target = project.new_target(:ui_test_bundle, 'PitchesUITests', :ios, '16.4')
group = project.main_group.find_subpath('PitchesUITests', true)
group.clear
target.add_file_references([group.new_reference(src_path)])
target.add_dependency(app)
target.build_configurations.each do |c|
  c.build_settings['TEST_TARGET_NAME'] = 'Pitches'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'ai.pitches.app.uitests'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['PRODUCT_NAME'] = 'PitchesUITests'
  c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(proj_path, 'PitchesUITests', true)
puts "added"
